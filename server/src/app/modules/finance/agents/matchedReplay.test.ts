import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runMatchedReplay,replayFallback,replayChoiceSchema,replayHash,REPLAY_VERSION,type ReplaySnapshot } from './matchedReplay';

export const replayFixture = ():ReplaySnapshot=>({
  version:REPLAY_VERSION,asOf:'2026-10-18T00:00:00.000Z',policyVersions:[],openingCash:10000,dailyInflow:1000,dailyOutflow:1100,pd:0.3,fundingRatePct:8,maxLenderExposure:20000,capital:3000,
  loans:[{id:'a',amount:10000,rate:14,baseRate:10,minRate:10,maxRate:20,feePct:1,months:6,lgd:0.55},{id:'b',amount:10000,rate:16,baseRate:10,minRate:10,maxRate:20,feePct:1,months:12,lgd:0.55}],
  debts:[{id:'old',amount:1000,daysOverdue:80,collectionProbability:1},{id:'recent',amount:3000,daysOverdue:40,collectionProbability:1}],
  commitments:[{id:'rent',amount:15000,day:4}],skus:[{id:'tea',revenue:10000,margin:0.2},{id:'rice',revenue:5000,margin:0.1}],
});
test('matched replay is reproducible with the same frozen seed, inputs and choices',()=>{
  const input=replayFixture(),choice=replayFallback(input);
  assert.deepEqual(runMatchedReplay(input,choice,12345),runMatchedReplay(input,choice,12345));
  assert.equal(replayHash({b:1,a:{y:2,x:3}}),replayHash({a:{x:3,y:2},b:1}),'JSONB key reordering must not change replay identity');
  const result=runMatchedReplay(input,choice,12345);
  assert.equal(result.scorecards.length,4);assert.equal(result.paths.length,8);
  assert(result.scorecards.every(s=>s.basis==='MATCHED_SANDBOX'&&s.status==='COMPLETE'));
  assert.equal(result.scorecards[2].alpha,0,'the baseline eventually collects the same debt in the shared horizon');
  assert((result.scorecards[2].avoidedShortfallAmount??0)>=0);
});
test('both arms share default events including loans declined by the participant',()=>{
  const input={...replayFixture(),pd:1}; const choice={...replayFallback(input),fundLoanIDs:[]};
  const result=runMatchedReplay(input,choice,8);
  assert(result.paths.every(p=>p.shocks.loans.every(month=>month===1)));
  assert(result.paths.every(p=>p.pairs[0].baseline.events.some(e=>e.kind==='default-recovery')));
  assert(result.paths.every(p=>p.pairs[0].participant.value===0));
  assert((result.scorecards[0].baseline??0)<0,'declined loans remain in the baseline universe');
});
test('negative alpha and zero outcomes are retained rather than forcing a win',()=>{
  const input={...replayFixture(),pd:0}; const choice={...replayFallback(input),fundLoanIDs:[],collectDebtIDs:[],allocation:[]};
  const result=runMatchedReplay(input,choice,1);
  assert((result.scorecards[0].alpha??0)<0);assert((result.scorecards[2].alpha??0)<0);assert((result.scorecards[3].alpha??0)<0);
});
test('policy cannot add identifiers or spend beyond the matched budget',()=>{
  const input=replayFixture(),choice=replayFallback(input);
  for(const invalid of [{...choice,fundLoanIDs:['foreign']},{...choice,collectDebtIDs:['old','old']},{...choice,borrowerOfferID:'foreign'},{...choice,allocation:[{skuID:'tea',amount:3001}]}]) assert.equal(replayChoiceSchema(input).safeParse(invalid).success,false);
  assert.throws(()=>runMatchedReplay({...input,loans:[input.loans[0],{...input.loans[1],amount:9999}]},choice,0),/equal-principal/);
});
test('insufficient role data stays pending and tiny capital is not overallocated',()=>{
  const input={...replayFixture(),loans:[],skus:[],capital:0};
  const result=runMatchedReplay(input,replayFallback(input),1);
  assert.equal(result.scorecards[0].alpha,null);assert.equal(result.scorecards[1].alpha,null);assert.equal(result.scorecards[3].alpha,null);
  const tiny={...replayFixture(),capital:0.02,skus:[...replayFixture().skus,{id:'oil',revenue:1,margin:1},{id:'salt',revenue:1,margin:1}]};
  assert.doesNotThrow(()=>runMatchedReplay(tiny,replayFallback(tiny),1));
});
