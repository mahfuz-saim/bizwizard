import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evidenceEnvironment } from './evidence-scenarios';
import { comparisonInput, fixtureChoice, measureComparison } from '../src/app/modules/finance/agents/comparison';
import { expenseSpikeRatio } from '../src/app/modules/finance/shared/expenseSpike';
import { benchmarkSummary, evidenceSummary, replaySummary } from './cli-report';

test('CLI benchmark reports honest winners, signed differences and USD costs', () => {
  const row = { success:true,usedFallback:false,model:'gpt-4o-mini',latencyMs:1234,usage:{costUsdEstimate:0.000123},comparison:{caseID:'synthetic',measurements:[
    {agent:'BORROWER_AGENT',baseline:100,participant:90,differenceInFavourOfParticipant:10},
    {agent:'LENDER_AGENT',baseline:100,participant:90,differenceInFavourOfParticipant:-10},
    {agent:'ANALYST_AGENT',baseline:0,participant:0,differenceInFavourOfParticipant:0},
  ]}};
  const plain=benchmarkSummary(true,[row],false);
  assert.match(plain,/AI wins 1 \| Rules wins 1 \| Ties 1/);
  assert.match(plain,/\+10\.00/);assert.match(plain,/-10\.00/);
  assert.match(plain,/USD 0\.000123/);assert.match(plain,/1\.23s/);
  assert(!plain.includes('\x1b'));
  assert(benchmarkSummary(true,[row],true).includes('\x1b[32mPASS\x1b[0m'));
  const fallback=benchmarkSummary(true,[{...row,success:false,usedFallback:true}],false);
  assert.match(fallback,/Fixture fallback/);assert.match(fallback,/Not counted/);
  assert.match(fallback,/AI wins 0 \| Rules wins 0 \| Ties 0/);
  assert.match(benchmarkSummary(false,[{...row,usedFallback:true}],false),/Offline fixture policy \(NOT AI\)/);
  assert.match(benchmarkSummary(true,[{...row,success:false,comparison:null}],false),/No valid comparison/);
});

test('CLI evidence distinguishes failed, skipped, cancelled and unrun work', () => {
  const output=evidenceSummary(false,[
    {name:'apply-migrations',success:true,durationMs:100,summaries:[]},
    {name:'test-step',success:false,durationMs:200,summaries:['# pass 2','# fail 1','# skipped 1','# cancelled 1']},
  ],6,false);
  assert.match(output,/Overall: FAIL \| Steps passed: 1\/6 \| Not run: 4/);
  assert.match(output,/Tests: 2 passed \| 1 failed \| 1 skipped \| 1 cancelled/);
  assert.match(output,/Total step time: 0\.30s/);
  assert.match(evidenceSummary(true,[{name:'test',success:true,durationMs:100,summaries:['# pass 2']}],1,false),/Overall: PASS/);
});

test('CLI replay displays verification failure and leaves missing measurements pending', () => {
  const output=replaySummary(false,[{agentType:'LENDER_AGENT',baseline:null,participant:null,alpha:null}],false);
  assert.match(output,/Outcome hash match: FAIL/);assert.match(output,/Pending/);
  assert.match(output,/Database\/API: not required/);
  assert.match(replaySummary(true,[],false),/Outcome hash match: PASS/);
});

test('evidence refuses production, remote connections and host overrides', () => {
  for (const url of [undefined,'postgresql://localhost/simulator_test','postgresql://127.0.0.1/production','postgresql://127.0.0.1/simulator_test?host=example.com','https://127.0.0.1/simulator_test']) assert.throws(() => evidenceEnvironment(url));
  const a = evidenceEnvironment('postgresql://127.0.0.1/simulator_test');
  const b = evidenceEnvironment('postgresql://127.0.0.1/simulator_test');
  assert.notEqual(a.schema,b.schema);
  assert.equal(a.env.OPENAI_API_KEY,'');
  assert.equal(new URL(a.env.DATABASE_URL).searchParams.get('schema'),a.schema);
});
test('all four comparisons reproduce fixed results without forcing a win', () => {
  for (const risk of [0.05,0.2,0.5]) {
    const input = comparisonInput(risk);
    const a = measureComparison(input,fixtureChoice(input));
    assert.deepEqual(a,measureComparison(input,fixtureChoice(input)));
    assert.equal(a.measurements.length,4);
  }
  const input = comparisonInput(0.05);
  assert(measureComparison(input,fixtureChoice(input)).measurements[0].differenceInFavourOfParticipant < 0);
  assert.equal(measureComparison(input,fixtureChoice(input)).measurements[2].differenceInFavourOfParticipant,0,'the baseline can collect a debt that crosses 60 days within the shared horizon');
  assert.throws(() => measureComparison(input,{ ...fixtureChoice(input),offerID:'short-term' }),/affordability/);
  assert.throws(() => measureComparison(input,{ ...fixtureChoice(input),allocation:[1,1,1] }));
});
test('spike baseline excludes recent expenses, future rows and other categories', () => {
  const asOf = new Date('2026-10-18T00:00:00Z');
  const rows = [100,200,300].map(amount => ({ amount,expenseType:'GENERAL',createdAt:new Date('2026-10-01') }));
  rows.push({ amount:600,expenseType:'GENERAL',createdAt:new Date('2026-10-17') });
  rows.push({ amount:99999,expenseType:'GENERAL',createdAt:new Date('2026-10-19') });
  assert.equal(expenseSpikeRatio(rows,asOf),3);
  assert.equal(expenseSpikeRatio([],asOf),0);
});
