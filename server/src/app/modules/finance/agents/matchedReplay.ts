import { z } from 'zod';
import { hashInput } from '../../../../lib/ai/client';
import { amortizationSchedule, effectiveApr, roundCurrency, sumMoney } from '../shared/money';
import { lenderBenchmarkRate, borrowerBenchmarkPick } from './benchmarks';
import { mulberry32, seedFromString } from '../simulator/simulatorEngine';

export const REPLAY_VERSION = 'shop-paired-replay-v1';
export function replayHash(value: unknown): string {
  const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v==='object' ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,item])=>[k,canonical(item)])) : v;
  return hashInput(canonical(value));
}
const money = z.number().finite().min(0).max(1e12).refine(n=>roundCurrency(n)===n,'Currency must have at most two decimal places');
export const replaySnapshotSchema = z.object({
  version: z.literal(REPLAY_VERSION), asOf: z.string().datetime(),
  policyVersions: z.array(z.object({ id: z.string(), agentType: z.string(), version: z.number().int(), riskAppetite: z.number().min(0).max(1).optional() })).max(4),
  openingCash: z.number().finite().min(-1e12).max(1e12), dailyInflow: money, dailyOutflow: money,
  pd: z.number().min(0).max(1), fundingRatePct: z.number().min(0).max(100),
  capital: money, maxLenderExposure: money,
  loans: z.array(z.object({ id: z.string().min(1), amount: money.refine(n=>n>0,'Loan principal must be positive'), rate: z.number().min(0).max(100), baseRate: z.number().min(0).max(100), minRate: z.number().min(0).max(100), maxRate: z.number().min(0).max(100), feePct: z.number().min(0).max(100), months: z.number().int().min(1).max(60), lgd: z.number().min(0).max(1) })).max(5),
  debts: z.array(z.object({ id: z.string(), amount: money, daysOverdue: z.number().int().min(0), collectionProbability: z.number().min(0).max(1) })).max(20),
  commitments: z.array(z.object({ id: z.string(), amount: money, day: z.number().int().min(0).max(29) })).max(100),
  skus: z.array(z.object({ id: z.string(), revenue: money, margin: z.number().min(-1).max(1) })).max(5),
});
export type ReplaySnapshot = z.infer<typeof replaySnapshotSchema>;
const choiceShape = z.object({
  fundLoanIDs: z.array(z.string()).max(5), borrowerOfferID: z.string().nullable(), collectDebtIDs: z.array(z.string()).max(20),
  allocation: z.array(z.object({ skuID: z.string(), amount: money })).max(5),
});
export type ReplayChoice = z.infer<typeof choiceShape>;
export function replayChoiceSchema(snapshot: ReplaySnapshot) {
  return choiceShape.superRefine((choice, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    for (const [ids, universe] of [[choice.fundLoanIDs,snapshot.loans],[choice.collectDebtIDs,snapshot.debts],[choice.allocation.map(a=>a.skuID),snapshot.skus]] as const) {
      if (new Set(ids).size !== ids.length || ids.some(id => !universe.some(row=>row.id===id))) fail('Choose unique identifiers from the frozen universe');
    }
    if (snapshot.loans.length ? !snapshot.loans.some(l=>l.id===choice.borrowerOfferID) : choice.borrowerOfferID!==null) fail('Select one available borrower offer, or null only when none exist');
    if (sumMoney(snapshot.loans.filter(l=>choice.fundLoanIDs.includes(l.id)).map(l=>l.amount)) > snapshot.maxLenderExposure) fail('Lender exposure exceeds the frozen mandate');
    if (sumMoney(choice.allocation.map(a=>a.amount)) > snapshot.capital) fail('Allocation exceeds the frozen capital budget');
  });
}
export function replayFallback(snapshot: ReplaySnapshot): ReplayChoice {
  const best = [...snapshot.skus].sort((a,b)=>b.margin-a.margin)[0];
  const cheapest = [...snapshot.loans].sort((a,b)=>sumMoney(amortizationSchedule(a.amount,a.rate,a.months).map(p=>p.totalDue)) + a.amount*a.feePct/100 - sumMoney(amortizationSchedule(b.amount,b.rate,b.months).map(p=>p.totalDue)) - b.amount*b.feePct/100)[0];
  return { fundLoanIDs: snapshot.loans.filter(l=>l.rate-snapshot.fundingRatePct > snapshot.pd*l.lgd*100*12/l.months).map(l=>l.id),
    borrowerOfferID: cheapest?.id ?? null, collectDebtIDs: snapshot.debts.map(d=>d.id), allocation: best && best.margin>0 ? [{ skuID:best.id,amount:snapshot.capital }] : [] };
}

type Event = { period: number; reference: string; kind: string; amount: number };
type Arm = { value: number; events: Event[]; maxShortfall?: number };
function credit(loan: ReplaySnapshot['loans'][number], rate: number, defaultMonth: number | null, fundingRate: number): Arm {
  const schedule = amortizationSchedule(loan.amount,rate,loan.months);
  const events: Event[] = [{ period:0,reference:loan.id,kind:'principal-disbursed',amount:-loan.amount },{ period:0,reference:loan.id,kind:'processing-fee-received',amount:roundCurrency(loan.amount*loan.feePct/100) }];
  let balance = loan.amount;
  for (const payment of schedule) {
    events.push({ period:payment.installmentNo,reference:loan.id,kind:'funding-cost',amount:-roundCurrency(balance*fundingRate/1200) });
    if (defaultMonth===payment.installmentNo) {
      events.push({ period:payment.installmentNo,reference:loan.id,kind:'default-recovery',amount:roundCurrency(balance*(1-loan.lgd)) }); break;
    }
    events.push({ period:payment.installmentNo,reference:loan.id,kind:'repayment-received',amount:payment.totalDue }); balance=payment.balanceAfter;
  }
  return { value:sumMoney(events.map(e=>e.amount)), events };
}
function borrowing(loan: ReplaySnapshot['loans'][number]): Arm {
  const events = [{ period:0,reference:loan.id,kind:'processing-fee-paid',amount:roundCurrency(loan.amount*loan.feePct/100) },
    ...amortizationSchedule(loan.amount,loan.rate,loan.months).map(p=>({ period:p.installmentNo,reference:loan.id,kind:'installment-paid',amount:p.totalDue }))];
  return { value:roundCurrency(sumMoney(events.map(e=>e.amount))-loan.amount),events };
}
function cash(snapshot: ReplaySnapshot, collect: string[], baseline: boolean, shocks: ReturnType<typeof makeShocks>): Arm {
  const events: Event[] = []; let balance=snapshot.openingCash; let maxShortfall=Math.max(0,-balance);
  for (let day=0;day<30;day++) {
    const daily: Event[] = [
      { period:day,reference:'business',kind:'inflow',amount:roundCurrency(snapshot.dailyInflow*shocks.days[day]) },
      { period:day,reference:'business',kind:'outflow',amount:-roundCurrency(snapshot.dailyOutflow*shocks.days[day]) },
      ...snapshot.commitments.filter(c=>c.day===day).map(c=>({ period:day,reference:c.id,kind:'commitment-paid',amount:-c.amount })),
    ];
    snapshot.debts.forEach((debt,i)=>{
      const requestDay=baseline ? Math.max(0,61-debt.daysOverdue) : 0;
      if (collect.includes(debt.id) && requestDay===day && shocks.debts[i]<debt.collectionProbability) daily.push({ period:day,reference:debt.id,kind:'debt-payment-received',amount:debt.amount });
    });
    balance=roundCurrency(balance+sumMoney(daily.map(e=>e.amount))); maxShortfall=Math.max(maxShortfall,-balance); events.push(...daily);
  }
  return { value:balance,events,maxShortfall:roundCurrency(maxShortfall) };
}
function allocation(snapshot: ReplaySnapshot, amounts: ReplayChoice['allocation'], shocks: ReturnType<typeof makeShocks>): Arm {
  const events = amounts.map(a=>({ period:30,reference:a.skuID,kind:'modeled-incremental-gross-margin',amount:roundCurrency(a.amount*snapshot.skus.find(s=>s.id===a.skuID)!.margin*shocks.skus[snapshot.skus.findIndex(s=>s.id===a.skuID)]) }));
  return { value:sumMoney(events.map(e=>e.amount)),events };
}
function makeShocks(snapshot: ReplaySnapshot, seed: number) {
  const rand=mulberry32(seed);
  // Quantized draws survive Prisma JSONB round trips without changing replay hashes.
  const quantize=(n:number)=>Math.round(n*1e6)/1e6;
  const loans=snapshot.loans.map(loan=>{
    const hazard=1-Math.pow(1-snapshot.pd,1/loan.months); let first: number|null=null;
    for (let month=1;month<=loan.months;month++) if (rand()<hazard && first===null) first=month;
    return first;
  });
  return { loans,debts:snapshot.debts.map(()=>Math.floor(rand()*1e6)/1e6),skus:snapshot.skus.map(()=>quantize(0.5+rand())),days:Array.from({length:30},()=>quantize(0.8+rand()*0.4)) };
}
export function runMatchedReplay(rawSnapshot: ReplaySnapshot, rawChoice: ReplayChoice, seed: number) {
  const snapshot=replaySnapshotSchema.parse(rawSnapshot); const choice=replayChoiceSchema(snapshot).parse(rawChoice);
  if (new Set(snapshot.loans.map(l=>l.amount)).size>1 || new Set(snapshot.loans.map(l=>l.id)).size!==snapshot.loans.length || sumMoney(snapshot.loans.map(l=>l.amount))>snapshot.maxLenderExposure) throw new Error('The matched loan universe must be unique, equal-principal and exposure-bounded');
  if (!Number.isInteger(seed) || seed<0 || seed>0xffffffff) throw new Error('Invalid replay seed');
  const baselineBorrower=borrowerBenchmarkPick(snapshot.loans.map(l=>({ ...l,offeredAmount:l.amount,effectiveApr:effectiveApr(l.amount,l.rate,l.months,l.feePct),totalRepayment:sumMoney(amortizationSchedule(l.amount,l.rate,l.months).map(p=>p.totalDue))+roundCurrency(l.amount*l.feePct/100) })));
  const equalShare=Math.floor(snapshot.capital*100/Math.max(1,snapshot.skus.length))/100;
  const baselineAllocation=snapshot.skus.map((s,i)=>({ skuID:s.id,amount: i===snapshot.skus.length-1 ? roundCurrency(snapshot.capital-equalShare*(snapshot.skus.length-1)) : equalShare }));
  const paths=Array.from({length:8},(_,path)=>{
    const shocks=makeShocks(snapshot,seedFromString(`${seed}:${path}`));
    const lenderBase=snapshot.loans.map((l,i)=>credit(l,lenderBenchmarkRate({baseRate:l.baseRate,interestRateMin:l.minRate,interestRateMax:l.maxRate}),shocks.loans[i],snapshot.fundingRatePct));
    const lenderParticipant=snapshot.loans.filter(l=>choice.fundLoanIDs.includes(l.id)).map(l=>credit(l,l.rate,shocks.loans[snapshot.loans.findIndex(x=>x.id===l.id)],snapshot.fundingRatePct));
    const lender=(arms:Arm[]):Arm=>({value:sumMoney(arms.map(a=>a.value)),events:arms.flatMap(a=>a.events)});
    const borrower=snapshot.loans.find(l=>l.id===choice.borrowerOfferID);
    const pairs=[
      { agentType:'LENDER_AGENT',metric:'net-credit-cash-return-after-funding',horizonDays:Math.max(0,...snapshot.loans.map(l=>l.months*30)),available:snapshot.loans.length>0,baseline:lender(lenderBase),participant:lender(lenderParticipant),lowerIsBetter:false },
      { agentType:'BORROWER_AGENT',metric:'full-term-borrowing-cost',horizonDays:Math.max(baselineBorrower?.months??0,borrower?.months??0)*30,available:!!baselineBorrower&&!!borrower,baseline:baselineBorrower?borrowing(baselineBorrower):{value:0,events:[]},participant:borrower?borrowing(borrower):{value:0,events:[]},lowerIsBetter:true },
      { agentType:'TREASURER_AGENT',metric:'30-day-closing-cash-not-profit',horizonDays:30,available:true,baseline:cash(snapshot,snapshot.debts.map(d=>d.id),true,shocks),participant:cash(snapshot,choice.collectDebtIDs,false,shocks),lowerIsBetter:false },
      { agentType:'ANALYST_AGENT',metric:'30-day-modeled-capital-gross-margin',horizonDays:30,available:snapshot.skus.length>0&&snapshot.capital>0,baseline:allocation(snapshot,baselineAllocation,shocks),participant:allocation(snapshot,choice.allocation,shocks),lowerIsBetter:false },
    ];
    return { path,shocks,sharedOutcomeHash:replayHash(shocks),pairs:pairs.map(p=>({ ...p,alpha:p.available?roundCurrency((p.participant.value-p.baseline.value)*(p.lowerIsBetter?-1:1)):null })) };
  });
  const scorecards=paths[0].pairs.map((pair,i)=>{
    const samples=paths.map(p=>p.pairs[i]);
    return {agentType:pair.agentType,metric:pair.metric,horizonDays:pair.horizonDays,basis:'MATCHED_SANDBOX' as const,status:pair.available?'COMPLETE':'INSUFFICIENT_DATA',
      participant:pair.available?roundCurrency(sumMoney(samples.map(p=>p.participant.value))/samples.length):null,
      baseline:pair.available?roundCurrency(sumMoney(samples.map(p=>p.baseline.value))/samples.length):null,
      alpha:pair.available?roundCurrency(sumMoney(samples.map(p=>p.alpha??0))/samples.length):null,
      winRatePct:pair.available?roundCurrency(samples.filter(p=>(p.alpha??0)>0).length/samples.length*100):null,
      avoidedShortfallAmount:pair.agentType==='TREASURER_AGENT'?roundCurrency(sumMoney(samples.map(p=>(p.baseline.maxShortfall??0)-(p.participant.maxShortfall??0)))/samples.length):null,
      reason:pair.available?null:pair.agentType==='ANALYST_AGENT'?'No available capital above the buffer floor or no product economics.':'Run financing matching first; an equal-principal feasible quote universe is required.'};
  });
  return {version:REPLAY_VERSION,basis:'MATCHED_SANDBOX' as const,currency:'BDT',seed,snapshotHash:replayHash(snapshot),choices:choice,scorecards,paths,
    assumptions:[
      'Eight paired simulated paths, not observed real-world financial outcomes or a statistically established treatment effect. Negative and zero alpha are retained.',
      'Both arms share a frozen universe, opening state, exogenous draws and per-role horizon. No shocks or seed are sent to the model before its choices are frozen.',
      'Lender: pinned flat-rate policy funds every quote in the exposure-bounded universe; the participant may decline. Shared term-default probability and LGD generate identical default months per opportunity; defaults do not depend on the chosen interest rate.',
      'Lender quote opportunities are independent hypothetical loans, not multiple real loans issued to this business. Recovery is immediate at modeled default, funding is charged monthly on remaining principal.',
      'Borrower: both arms repay the selected loan in full with no default. The baseline chooses lowest APR among equal-principal affordable quotes. This experiment is independent of the lender default experiment.',
      'Quote rates are the latest recorded terms at snapshot time, not reconstructed pre-negotiation offers. Fees and lender base-rate bands come from the captured current catalog. This is not a historical contract reconciliation.',
      'Treasurer: one collection request per debt, with a common age-bucket success draw; baseline waits until strictly over 60 days overdue, participant requests selected debts immediately. No spontaneous collections or collection fees. Daily inflow/outflow share the same historical-level shock.',
      'Analyst: equal baseline allocation across the frozen revenue-ranked SKUs versus selected amounts; a common demand multiplier scales historical contribution margin. No capacity, inventory-turnover or causal model is claimed. Unallocated capital earns no return.',
      'Receivable age since creation is used as the overdue proxy. Scheduled commitments are added to historical-level outflows and may overlap typical historical expenses; this common flow model is not bank reconciliation.',
      'These role-specific metrics must not be added into one financial return. Gross collections and cash balances are not profit; USD API costs are recorded separately.',
    ]};
}
