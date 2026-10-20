/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../../../shared/prisma';
import { simulationContext } from '../shared/database';
import { cashflowService } from '../cashflow/cashflow.service';

export const simulationError = (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode });

export async function workspaceFor(tenantID: string, shopID: string) {
  const shop = await prisma.shop.findFirst({ where: { id: shopID, tenantID } });
  if (!shop) throw simulationError('Shop not found', 404);
  return shop;
}

export async function lockedWorkspace<T>(tenantID: string, shopID: string, work: (tx: any, shop: any) => Promise<T>) {
  return prisma.$transaction(async tx => {
    const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(hashtext(${`simulator:${shopID}`})) AS locked`;
    if (!lock.locked) throw simulationError('This demo workspace is busy. Wait for the current operation to finish.');
    const shop = await tx.shop.findFirst({ where: { id: shopID, tenantID } });
    if (!shop) throw simulationError('Shop not found', 404);
    return work(tx, shop);
  }, { timeout: 120000, maxWait: 10000, isolationLevel: 'RepeatableRead' });
}

export async function requireDemo(tx: any, tenantID: string, shopID: string) {
  const shop = await tx.shop.findFirst({ where: { id: shopID, tenantID } });
  if (!shop?.simulationSourceShopID || !shop.simulationBaselineAt || !shop.simulationAsOf)
    throw simulationError('Simulation is allowed only in a dedicated demo workspace.', 403);
  return shop;
}

export async function copyBaseline(tx: any, source: any, demoID: string) {
  const tenantID = source.tenantID;
  const ids = new Map<string, string>();
  const remap = (id: string | null) => id ? ids.get(id) ?? null : null;
  let latest = 0;
  const copy = async (model: string, where: any, patch: (row: any) => any) => {
    const rows = await tx[model].findMany({ where: { tenantID, ...where } });
    for (const row of rows) ids.set(row.id, randomUUID());
    const data = rows.map((row: any) => {
      const time = row.occurredAt ?? row.createdAt;
      if (['checkout', 'expenseItem', 'cashTransaction'].includes(model) && time) latest = Math.max(latest, new Date(time).getTime());
      return { ...row, id: ids.get(row.id), ...patch(row) };
    });
    // These full-row copies are already validated database records. PostgreSQL
    // can restore their column types without Prisma encoding each field separately.
    const bulkModel = ['checkout', 'checkoutItem', 'cashTransaction'].includes(model)
      ? Prisma.dmmf.datamodel.models.find(m => m.name.toLowerCase() === model.toLowerCase()) : undefined;
    if (bulkModel) {
      const table = Prisma.raw(`"${bulkModel.dbName ?? bulkModel.name}"`);
      const columns = Prisma.join(bulkModel.fields.filter(f => f.kind !== 'object').map(f => Prisma.raw(`"${f.dbName ?? f.name}"`)));
      for (let i = 0; i < data.length; i += 5000) {
        await tx.$executeRaw`INSERT INTO ${table} (${columns}) SELECT ${columns}
          FROM jsonb_populate_recordset(NULL::${table}, ${JSON.stringify(data.slice(i, i + 5000))}::jsonb)`;
      }
      return;
    }
    for (let i = 0; i < data.length; i += 500) await tx[model].createMany({ data: data.slice(i, i + 500) });
  };
  await copy('shopBuyer', { shopID: source.id }, () => ({ shopID: demoID }));
  await copy('shopSupplier', { shopId: source.id }, () => ({ shopId: demoID }));
  await copy('shopVariant', { shopID: source.id }, () => ({ shopID: demoID }));
  await copy('lot', { ShopVariant: { shopID: source.id } }, r => ({ shopVariantId: remap(r.shopVariantId), supplyId: remap(r.supplyId) }));
  await copy('checkout', { shopID: source.id, isSimulated: false }, () => ({ shopID: demoID, soldByOwnerId: null, soldByEmployeeId: null }));
  await copy('checkoutItem', { checkout: { shopID: source.id, isSimulated: false } }, r => ({ checkoutID: remap(r.checkoutID), lotId: remap(r.lotId), variantId: remap(r.variantId) }));
  await copy('debt', { shopID: source.id, isSimulated: false, checkout: { isSimulated: false } }, r => ({ shopID: demoID, checkoutID: remap(r.checkoutID) }));
  // DebtPayments has no tenantID; its tenant boundary is the parent debt.
  const payments = await tx.debtPayments.findMany({ where: { isSimulated: false, debt: { tenantID, shopID: source.id, isSimulated: false } } });
  for (const row of payments) ids.set(row.id, randomUUID());
  if (payments.length) await tx.debtPayments.createMany({ data: payments.map((r: any) => ({ ...r, id: ids.get(r.id), debtId: remap(r.debtId) })) });
  await copy('expense', { shopID: source.id }, () => ({ shopID: demoID, totalAmount: 0 }));
  await copy('expenseItem', { isSimulated: false, expense: { shopID: source.id } }, r => ({ expenseID: remap(r.expenseID), shopVariantId: remap(r.shopVariantId), lotId: remap(r.lotId), supplierId: remap(r.supplierId) }));
  const totals = await tx.expenseItem.groupBy({ by: ['expenseID'], where: { tenantID, expense: { shopID: demoID } }, _sum: { amount: true } });
  for (const total of totals) await tx.expense.update({ where: { id: total.expenseID }, data: { totalAmount: total._sum.amount ?? 0 } });
  await copy('cashAccount', { shopID: source.id }, () => ({ shopID: demoID }));
  await copy('cashTransaction', { shopID: source.id, isSimulated: false }, r => ({ shopID: demoID, accountID: remap(r.accountID), sourceRefID: remap(r.sourceRefID) }));
  await copy('cashCommitment', { shopID: source.id }, r => ({ shopID: demoID, paymentExpenseID: remap(r.paymentExpenseID) }));
  await copy('aiAgentPolicy', { shopID: source.id, isActive: true }, () => ({ shopID: demoID }));
  const baselineAt = new Date(latest || Date.now());
  baselineAt.setUTCHours(23, 59, 59, 999);
  await tx.shop.update({ where: { id: demoID }, data: { simulationBaselineAt: baselineAt, simulationAsOf: baselineAt, simulationRunID: null, simulationResult: Prisma.DbNull } });
  await simulationContext.run({ client: tx, asOf: baselineAt }, async () => {
    if (!await tx.cashTransaction.count({ where: { tenantID, shopID: demoID } })) await cashflowService.backfill(tenantID, demoID);
  });
  return baselineAt;
}

export async function prepareWorkspace(tenantID: string, sourceID: string) {
  return lockedWorkspace(tenantID, sourceID, async (tx, source) => {
    if (source.simulationSourceShopID) throw simulationError('Choose a source shop, not another demo workspace.');
    let demo = await tx.shop.findUnique({ where: { simulationSourceShopID: sourceID } });
    if (!demo) {
      demo = await tx.shop.create({ data: {
        shopName: `${source.shopName} — Simulation demo`, contact: source.contact, category: source.category,
        tenantID, ownerID: source.ownerID, simulationSourceShopID: sourceID,
      } });
      await copyBaseline(tx, source, demo.id);
      demo = await tx.shop.findUniqueOrThrow({ where: { id: demo.id } });
    }
    return demo;
  });
}

export async function restoreWorkspace(tx: any, tenantID: string, shopID: string) {
  const demo = await requireDemo(tx, tenantID, shopID);
  const source = await tx.shop.findFirstOrThrow({ where: { id: demo.simulationSourceShopID, tenantID } });
  const scope = { tenantID, shopID };
  const notices = { tenantID, shopId: shopID };
  await tx.notificationRead.deleteMany({ where: { notification: notices } });
  await tx.notification.deleteMany({ where: notices });
  await tx.loanSchedule.deleteMany({ where: scope });
  await tx.treasuryActionEvidence.deleteMany({ where: scope });
  await tx.aiAgentPolicy.deleteMany({ where: scope });
  for (const model of ['financingNegotiation', 'financingApplication', 'financingOffer', 'financingMatch', 'financingMarketState', 'businessFinancialProfile', 'financialMetricSnapshot', 'cashFlowProjection', 'financeEvaluation', 'agentPerformance', 'capitalDecision', 'scenario', 'forecast', 'cashAlert', 'treasuryAction', 'insight', 'aiDecision', 'cashTransaction', 'cashAccount', 'cashCommitment']) {
    await tx[model].deleteMany({ where: scope });
  }
  await tx.debtPayments.deleteMany({ where: { debt: scope } });
  await tx.debt.deleteMany({ where: scope });
  await tx.checkout.deleteMany({ where: scope });
  await tx.expenseItem.deleteMany({ where: { tenantID, expense: { shopID } } });
  await tx.expense.deleteMany({ where: scope });
  await tx.lot.deleteMany({ where: { tenantID, ShopVariant: { shopID } } });
  await tx.shopVariant.deleteMany({ where: scope });
  const buyers = await tx.shopBuyer.findMany({ where: scope, select: { id: true } });
  const buyerIds = buyers.map((r: any) => r.id);
  await tx.buyerSystemTag.deleteMany({ where: { tenantID, buyerId: { in: buyerIds } } });
  await tx.buyerCustomTag.deleteMany({ where: { tenantID, buyerId: { in: buyerIds } } });
  await tx.shopBuyer.deleteMany({ where: scope });
  await tx.shopSupplier.deleteMany({ where: { tenantID, shopId: shopID } });
  const simulationAsOf = await copyBaseline(tx, source, shopID);
  return { shopID, simulationAsOf };
}
