/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomBytes } from 'node:crypto';
import prisma, { shopClock, simulationContext } from '../shared/database';
import { assertShop, loadProfileAggregates, loadCashTransactions, loadOpenDebts } from '../shared/shopData';
import { buildProfile } from '../shared/metricEngine';
import { dailyNetSeries, ageBucket, COLLECTION_PROB, expandCommitments } from '../shared/cashEngine';
import { roundCurrency, sumMoney, monthlyPayment } from '../shared/money';
import { analysisService } from '../analysis/analysis.service';
import { ensureDefaultPolicies } from '../shared/catalog';
import { probabilityOfDefault, lossGivenDefault } from './agentCore';
import { callStructured, hashInput } from '../../../../lib/ai/client';
import ApiError from '../../../../errors/ApiError';
import { REPLAY_VERSION, replaySnapshotSchema, replayChoiceSchema, replayFallback, runMatchedReplay, replayHash, type ReplaySnapshot } from './matchedReplay';

const db = () => prisma as any;
const DAY=86400000;
const json = (value: unknown) => JSON.parse(JSON.stringify(value));

async function capture(tenantId: string, shopId: string): Promise<ReplaySnapshot> {
  const asOf=await shopClock(tenantId,shopId);
  return db().$transaction(async (tx:any)=>simulationContext.run({client:tx,asOf},async()=>{
    await assertShop(tenantId,shopId);
    const profile=buildProfile(await loadProfileAggregates(tenantId,shopId,90));
    if (profile.dataCompleteness<0.6) throw new ApiError(409,'Matched evaluation needs at least 60% sales-history completeness');
    const transactions=await loadCashTransactions(tenantId,shopId,90);
    if (new Set(transactions.map(t=>new Date(t.occurredAt).toISOString().slice(0,10))).size<14) throw new ApiError(409,'Backfill the cash ledger first; at least 14 days of cash history are required');
    const history=dailyNetSeries(transactions,90,asOf);
    const dailyInflow=roundCurrency(sumMoney(history.map(h=>h.inflow))/90);
    const dailyOutflow=roundCurrency(sumMoney(history.map(h=>h.outflow))/90);
    const policies=await tx.aiAgentPolicy.findMany({where:{tenantID:tenantId,shopID:shopId,isActive:true},orderBy:{agentType:'asc'}});
    const policy=(type:string)=>policies.find((p:any)=>p.agentType===type);
    const maxLenderExposure=policy('LENDER_AGENT')?.maxExposure??5000000;
    const quotes=await tx.financingOffer.findMany({where:{tenantID:tenantId,shopID:shopId,status:{in:['ISSUED','COUNTERED','ACCEPTED']},createdAt:{lte:asOf}},orderBy:[{createdAt:'desc'},{id:'asc'}],take:50});
    const products=await tx.financeProduct.findMany({where:{id:{in:quotes.map((q:any)=>q.financeProductID)}},include:{provider:true}});
    const loans: ReplaySnapshot['loans']=[];
    let exposure=0;
    for (const quote of quotes) {
      if (loans.length===5) break;
      if (quote.marketID!==quotes[0]?.marketID || roundCurrency(quote.offeredAmount)!==roundCurrency(quotes[0]?.offeredAmount)) continue;
      const product=products.find((p:any)=>p.id===quote.financeProductID);
      if (!product || quote.tenorMonths<product.minTenorMonths || quote.tenorMonths>Math.min(60,product.maxTenorMonths) || quote.offeredRate<product.interestRateMin || quote.offeredRate>product.interestRateMax) continue;
      if (quote.offeredAmount<=0 || exposure+quote.offeredAmount>maxLenderExposure || monthlyPayment(quote.offeredAmount,quote.offeredRate,quote.tenorMonths)>Math.max(0,profile.monthlyFreeCashFlow)*0.35) continue;
      loans.push({id:quote.id,amount:roundCurrency(quote.offeredAmount),rate:quote.offeredRate,baseRate:product.provider.baseRate,minRate:product.interestRateMin,maxRate:product.interestRateMax,feePct:product.processingFeePct,months:quote.tenorMonths,lgd:lossGivenDefault(product.collateralRequired)});
      exposure+=quote.offeredAmount;
    }
    const rawDebts=await loadOpenDebts(tenantId,shopId);
    const debts: ReplaySnapshot['debts']=[]; let collectionExposure=0;
    for (const debt of rawDebts.filter(d=>d.createdAt<=asOf)) {
      if (debts.length===20) break;
      if (collectionExposure+debt.amount>(policy('TREASURER_AGENT')?.maxExposure??500000)) continue;
      debts.push({id:debt.id,amount:debt.amount,daysOverdue:Math.max(0,Math.floor((asOf.getTime()-debt.createdAt.getTime())/DAY)),collectionProbability:COLLECTION_PROB[ageBucket(debt.createdAt,asOf)]??0.12});
      collectionExposure+=debt.amount;
    }
    const commitments=await tx.cashCommitment.findMany({where:{tenantID:tenantId,shopID:shopId,isPaid:false,createdAt:{lte:asOf}},orderBy:{id:'asc'}});
    const expanded=expandCommitments(commitments,asOf,30);
    const obligations=expanded.map((c:any,i:number)=>({id:`commitment-${i}`,amount:roundCurrency(c.amount),day:Math.max(0,Math.floor((new Date(c.date).getTime()-new Date(asOf.toISOString().slice(0,10)).getTime())/DAY))})).filter((c:any)=>c.day<30);
    if (obligations.length>100) throw new ApiError(409,'The matched sandbox supports up to 100 commitments per horizon');
    const economics=await analysisService.getProductEconomics(tenantId,shopId);
    const skus=[...economics].filter((p:any)=>p.revenue>0).sort((a:any,b:any)=>b.revenue-a.revenue||a.productKey.localeCompare(b.productKey)).slice(0,5).map((p:any,i:number)=>({id:`sku-${i}-${hashInput(p.productKey).slice(0,8)}`,revenue:p.revenue,margin:Math.max(-1,Math.min(1,p.contributionMargin/100))}));
    const buffer=(policy('TREASURER_AGENT')?.bufferTargetDays??14)*dailyOutflow;
    return replaySnapshotSchema.parse({version:REPLAY_VERSION,asOf:asOf.toISOString(),policyVersions:policies.map((p:any)=>({id:p.id,agentType:p.agentType,version:p.version,riskAppetite:p.riskAppetite})),
      openingCash:profile.currentCash,dailyInflow,dailyOutflow,pd:probabilityOfDefault(profile),fundingRatePct:policy('TREASURER_AGENT')?.config?.annualYieldPct??8,
      maxLenderExposure,capital:roundCurrency(Math.max(0,Math.min(profile.currentCash-buffer,policy('ANALYST_AGENT')?.maxExposure??100000))),loans,debts,commitments:obligations,skus});
  }),{isolationLevel:'RepeatableRead',timeout:30000});
}

export const matchedEvaluationService = {
  async list(tenantId:string,shopId:string) {
    await assertShop(tenantId,shopId);
    const rows=await db().financeEvaluation.findMany({where:{tenantID:tenantId,shopID:shopId},orderBy:{createdAt:'desc'},take:20});
    return rows.map((r:any)=>({id:r.id,createdAt:r.createdAt,status:r.status,model:r.model,usedFallback:r.usedFallback,costUsd:r.costUsd,version:r.version,inputHash:r.inputHash,failure:r.failure,scorecards:r.outcome?.scorecards??[]}));
  },
  async get(tenantId:string,shopId:string,id:string) {
    await assertShop(tenantId,shopId);
    const row=await db().financeEvaluation.findFirst({where:{id,tenantID:tenantId,shopID:shopId}});
    if (!row) throw new ApiError(404,'Evaluation not found');
    return row;
  },
  async run(tenantId:string,shopId:string,fetchImpl?:typeof fetch) {
    await assertShop(tenantId,shopId);
    await ensureDefaultPolicies(db(),tenantId,shopId);
    const snapshot=await capture(tenantId,shopId);
    const inputHash=replayHash({...snapshot,asOf:snapshot.asOf.slice(0,10)});
    const row=await db().financeEvaluation.upsert({where:{tenantID_shopID_inputHash:{tenantID:tenantId,shopID:shopId,inputHash}},create:{tenantID:tenantId,shopID:shopId,inputHash,version:REPLAY_VERSION,seed:randomBytes(4).readUInt32BE()&0x7fffffff,snapshot:json(snapshot)},update:{inputHash}});
    if (row.status==='COMPLETE'||row.status==='FAILED') return this.get(tenantId,shopId,row.id);
    if (row.status==='RUNNING'&&Date.now()-new Date(row.createdAt).getTime()>120000) {
      await db().financeEvaluation.updateMany({where:{id:row.id,status:'RUNNING'},data:{status:'FAILED',failure:'Interrupted evaluation retained for audit. No automatic paid retry or outcome resampling is performed.'}});
      return this.get(tenantId,shopId,row.id);
    }
    const claim=await db().financeEvaluation.updateMany({where:{id:row.id,status:'PREPARED'},data:{status:'RUNNING'}});
    if (!claim.count) throw new ApiError(409,'This frozen evaluation is already running; refresh its history rather than issuing another paid call');
    try {
      const frozen=replaySnapshotSchema.parse(row.snapshot);
      const call=await callStructured({tenantID:tenantId,shopID:shopId,agentType:'MATCHED_SANDBOX',purpose:'shop-matched-replay',promptVersion:REPLAY_VERSION,tier:'fast',pillar:'agents',subBudgetMs:20000,fetchImpl,
        system:'Return exactly one flat JSON object with all four required keys: {"fundLoanIDs":[],"borrowerOfferID":null,"collectDebtIDs":[],"allocation":[]}. Do not wrap it in role names or a choices object. Populate fundLoanIDs with loan id strings, borrowerOfferID with one loan id string (null ONLY if loans is empty), collectDebtIDs with debt id strings, and allocation with objects shaped {"skuID":"supplied SKU id","amount":0}. Choose only from the supplied frozen universe. Amounts are BDT, at most two decimal places, and total allocation must not exceed capital. Do not calculate or invent outcomes. Lender: maximize net credit return after funding and default loss within maxLenderExposure; declining loans is valid. Borrower: minimize full-term borrowing cost. Treasurer: speed safe debt collections. Analyst: maximize 30-day margin return. These are independent roles; do not move money between them. Empty action arrays are valid. Outcomes and seeds are intentionally hidden.',
        input:frozen,outputSchema:replayChoiceSchema(frozen),fallback:()=>replayFallback(frozen)});
      const frozenChoice=await db().financeEvaluation.updateMany({where:{id:row.id,status:'RUNNING'},data:{choices:json(call.data),choicesFrozenAt:new Date(),model:call.model,usedFallback:call.usedFallback,costUsd:call.run.costUsd}});
      if (!frozenChoice.count) throw new Error('Evaluation is no longer active');
      const outcome=runMatchedReplay(frozen,call.data,row.seed);
      await db().financeEvaluation.updateMany({where:{id:row.id,status:'RUNNING'},data:{status:'COMPLETE',outcome:json(outcome),completedAt:new Date()}});
    } catch {
      await db().financeEvaluation.updateMany({where:{id:row.id,status:'RUNNING'},data:{status:'FAILED',failure:'Evaluation failed; no financial transactions were executed. This failed attempt remains in history.'}});
      throw new ApiError(503,'Matched evaluation failed; the failed attempt is retained for audit');
    }
    return this.get(tenantId,shopId,row.id);
  },
};
