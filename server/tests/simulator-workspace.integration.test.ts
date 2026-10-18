import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import prisma from '../src/shared/prisma';
import { simulatorService } from '../src/app/modules/finance/simulator/simulator.service';
import { lockedWorkspace } from '../src/app/modules/finance/simulator/workspace';
import { shopClock } from '../src/app/modules/finance/shared/database';
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../src/config';
import { simulatorRoutes } from '../src/app/modules/finance/simulator/simulator.routes';
import { AuthService } from '../src/app/modules/auth/auth.service';
import { shopValidation } from '../src/app/modules/shop/shop.validation';

const enabled = process.env.SIMULATOR_TEST_DATABASE === '1';
test('isolated demo: migration, copied history, next-month runs, locking, rollback and reset', { skip: !enabled }, async t => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.pathname, '/simulator_test');
  const user = await prisma.user.create({ data: { number: randomUUID(), name: 'Test owner', role: ['OWNER'], status: 'ACTIVE', OTP: 0 } });
  await prisma.owner.create({ data: { userID: user.id, name: 'Test owner', number: user.number, email: `${randomUUID()}@example.invalid`, dob: '1990-01-01', address: 'Fixture' } });
  const tenant = await prisma.tenant.create({ data: { name: 'Simulator test tenant', ownerID: user.id } });
  const source = await prisma.shop.create({ data: { shopName: 'Two year source', tenantID: tenant.id, ownerID: user.id, contact: 'Fixture' } });
  const scope = { tenantID: tenant.id, shopID: source.id };
  const variant = await prisma.shopVariant.create({ data: { ...scope, name: 'Fixture product', variantCode: 'FIXTURE', totalProducts: 100 } });
  const lot = await prisma.lot.create({ data: { tenantID: tenant.id, shopVariantId: variant.id, stock: 100, mrp: 20, isMRPDefault: false, retail: 20, includeVAT: false, buyPrice: 10, sellPrice: 20 } });
  const account = await prisma.cashAccount.create({ data: { ...scope, name: 'Cash', accountType: 'CASH', openingBalance: 1000, currentBalance: 1000, isPrimary: true } });
  const dates = Array.from({length:730}, (_,i) => new Date(Date.UTC(2024,9,19+i,12)));
  const sales = dates.map(createdAt => ({ id: randomUUID(), ...scope, totalPrice: 100, totalQuantity: 5, status: 'PAID' as const, createdAt }));
  await prisma.checkout.createMany({ data: sales });
  await prisma.checkoutItem.createMany({ data: sales.map(s => ({ tenantID:tenant.id, checkoutID:s.id, lotId:lot.id, variantId:variant.id, productName:'Fixture product', quantity:5, unitPrice:20, discountedPrice:20, createdAt:s.createdAt })) });
  await prisma.cashTransaction.createMany({ data:sales.map(s => ({ ...scope, accountID:account.id, direction:'IN' as const, amount:100, category:'SALES_COLLECTION' as const, occurredAt:s.createdAt, sourceRefID:s.id })) });
  const expense = await prisma.expense.create({ data: { ...scope, year:2026, month:10, totalAmount:150 } });
  await prisma.expenseItem.create({ data: { tenantID:tenant.id, expenseID:expense.id, name:'Actual expense', amount:100, createdAt:dates[729] } });
  await prisma.expenseItem.create({ data: { tenantID:tenant.id, expenseID:expense.id, name:'Legacy simulation', amount:50, isSimulated:true, simulationRunID:'legacy', createdAt:dates[729] } });
  await prisma.cashCommitment.create({ data: { ...scope, name: 'Large upcoming supplier payment', category: 'OPERATING_EXPENSE', amount: 500000, dueDate: new Date('2026-10-21T12:00:00Z') } });
  async function snapshot() {
    return {
      shops:await prisma.shop.findMany({where:{id:source.id}}),
      checkouts:await prisma.checkout.findMany({where:scope,orderBy:{id:'asc'}}),
      items:await prisma.checkoutItem.findMany({where:{checkout:{shopID:source.id}},orderBy:{id:'asc'}}),
      expenses:await prisma.expense.findMany({where:scope}),
      expenseItems:await prisma.expenseItem.findMany({where:{expense:{shopID:source.id}},orderBy:{id:'asc'}}),
      cash:await prisma.cashTransaction.findMany({where:scope,orderBy:{id:'asc'}}),
      accounts:await prisma.cashAccount.findMany({where:scope}),
      lots:await prisma.lot.findMany({where:{shopVariantId:variant.id}}),
      policies:await prisma.aiAgentPolicy.findMany({where:scope,orderBy:{id:'asc'}}),
    };
  }
  await prisma.aiAgentPolicy.create({ data: { ...scope, agentType: 'TREASURER_AGENT', name: 'Source mandate', objective: 'Fixture', riskAppetite: 0.3, maxExposure: 500000, bufferTargetDays: 14 } });
  const before=await snapshot();
  for (const field of ['simulationSourceShopID', 'simulationBaselineAt', 'simulationAsOf', 'simulationRunID', 'simulationResult', 'simulationSource']) {
    await assert.rejects(() => shopValidation.updateShopZodSchema.parseAsync({body:{[field]:'forged'}}));
  }
  await assert.rejects(()=>simulatorService.fastForward(tenant.id,source.id),/dedicated demo/);
  await assert.rejects(()=>simulatorService.reset(tenant.id,source.id),/dedicated demo/);
  await assert.rejects(()=>simulatorService.prepare('wrong-tenant',source.id),/Shop not found/);
  const demo=await simulatorService.prepare(tenant.id,source.id);
  assert.equal((await prisma.aiAgentPolicy.findFirstOrThrow({where:{tenantID:tenant.id,shopID:demo.id,agentType:'TREASURER_AGENT'}})).name,'Source mandate');
  const me = await AuthService.getMe({ userID: user.id, role: 'OWNER' });
  assert.equal(me?.defaultShopId, source.id, 'login never defaults to the cloned demo');
  config.jwt.secret = 'local-integration-test-only';
  const app = express();app.use(express.json());app.use('/simulator', simulatorRoutes);
  app.use((error: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => res.status(error.statusCode ?? 500).json({message:error.message}));
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const address=server.address() as {port:number};
  async function post(path:string, role:string, shopId:string, tenantID=tenant.id){
    const token=jwt.sign({userID:user.id,role},config.jwt.secret!,{expiresIn:'1h'});
    return fetch(`http://127.0.0.1:${address.port}/simulator/${path}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'x-tenant-id':tenantID},body:JSON.stringify({shopId})});
  }
  assert.equal((await post('fast-forward','EMPLOYEE',demo.id)).status,403);
  assert.equal((await post('fast-forward','OWNER',source.id)).status,403);
  assert.equal((await post('prepare','OWNER',source.id,'foreign-tenant')).status,403);
  assert.notEqual(demo.id,source.id);
  assert.equal((await simulatorService.prepare(tenant.id,source.id)).id,demo.id);
  const demoScope={tenantID:tenant.id,shopID:demo.id};
  assert.equal(await prisma.checkout.count({where:demoScope}),730);
  assert.equal(await prisma.expenseItem.count({where:{expense:{shopID:demo.id}}}),1);
  const clonedItem=await prisma.checkoutItem.findFirstOrThrow({where:{checkout:{shopID:demo.id}}});
  assert.notEqual(clonedItem.lotId,lot.id);
  const baseline=demo.simulationBaselineAt!.toISOString();
  let release!:()=>void;
  let acquired!:()=>void;
  const ready=new Promise<void>(resolve=>{acquired=resolve});
  const hold=new Promise<void>(resolve=>{release=resolve});
  const first=lockedWorkspace(tenant.id,demo.id,async()=>{acquired();await hold;return true});
  await ready;
  try { await assert.rejects(()=>simulatorService.reset(tenant.id,demo.id),/busy/); } finally { release(); }
  await first;
  const countBefore=await prisma.checkout.count({where:demoScope});
  await assert.rejects(()=>lockedWorkspace(tenant.id,demo.id,async tx=>{
    await tx.checkout.create({data:{...demoScope,totalPrice:1,totalQuantity:1,status:'PAID'}});
    throw new Error('rollback probe');
  }),/rollback probe/);
  assert.equal(await prisma.checkout.count({where:demoScope}),countBefore);
  const result=await simulatorService.fastForward(tenant.id,demo.id);
  assert.equal(result.dailyEvents.length,30);
  assert.equal(new Date(result.dailyEvents[0].date).getTime(),new Date(baseline.slice(0,10)).getTime()+86400000);
  assert.equal((await shopClock(tenant.id,demo.id)).toISOString(),result.endedAt);
  const notifications=await prisma.notification.findMany({where:{shopId:demo.id}});
  assert.ok(notifications.length>0,'daily treasury creates simulated critical notifications');
  for(const n of notifications){
    const data=n.data as {simulationRunID:string;simulationOccurredAt:string};
    assert.equal(data.simulationRunID,result.simulationRunID);
    assert.ok(result.dailyEvents.some(d=>d.events.some(e=>e.occurredAt===data.simulationOccurredAt)), 'notification uses a real simulated transaction timestamp');
  }
  await prisma.notificationRead.create({data:{notificationId:notifications[0].id,userId:user.id,tenantID:tenant.id,isRead:true}});
  const second=await simulatorService.fastForward(tenant.id,demo.id);
  assert.equal(second.startedAt,result.endedAt);
  assert.equal(new Date(second.dailyEvents[0].date).getTime(),new Date(result.dailyEvents[29].date).getTime()+86400000);
  await prisma.financeEvaluation.create({data:{...demoScope,inputHash:'reset-fixture',version:'shop-paired-replay-v1',seed:1,snapshot:{}}});
  await simulatorService.reset(tenant.id,demo.id);
  const reset=await prisma.shop.findUniqueOrThrow({where:{id:demo.id}});
  assert.equal(reset.simulationAsOf!.toISOString(),baseline);
  assert.equal(reset.simulationResult,null);
  assert.equal(await prisma.financeEvaluation.count({where:demoScope}),0);
  assert.equal(await prisma.checkout.count({where:demoScope}),730);
  assert.equal(await prisma.notification.count({where:{shopId:demo.id}}),0);
  const buckets=await prisma.expense.findMany({where:demoScope});
  assert.equal(buckets.reduce((sum,b)=>sum+b.totalAmount,0),100);
  await simulatorService.reset(tenant.id,demo.id);
  const simulatedDebts = await prisma.debt.findMany({ where: { tenantID: tenant.id, shopID: demo.id, isSimulated: true }, include: { checkout: true } });
  assert(simulatedDebts.every(debt => (debt.paidAmount ?? 0) <= debt.checkout.totalPrice), 'simulator cannot collect more than the debt');
  assert.deepEqual(await snapshot(),before,'original source is byte-for-byte unchanged');
  await prisma.$disconnect();
});
