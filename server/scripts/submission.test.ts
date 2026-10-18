import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evidenceEnvironment } from './evidence-scenarios';
import { comparisonInput, fixtureChoice, measureComparison } from '../src/app/modules/finance/agents/comparison';
import { expenseSpikeRatio } from '../src/app/modules/finance/shared/expenseSpike';

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
