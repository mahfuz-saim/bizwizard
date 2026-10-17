import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapWithConcurrency, withTimeout } from './concurrency';

test('mapWithConcurrency respects the in-flight limit', async () => {
  let inFlight = 0;
  let max = 0;
  const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 4, async (n) => {
    inFlight++;
    max = Math.max(max, inFlight);
    await new Promise((r) => setTimeout(r, 10));
    inFlight--;
    return n * 2;
  });
  assert.ok(max <= 4, `max in-flight was ${max}`);
  assert.deepEqual(results.map((r) => (r.status === 'fulfilled' ? r.value : 0)), [2, 4, 6, 8, 10, 12, 14, 16]);
});

test('a rejected item never fails the batch', async () => {
  const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
    if (n === 2) throw new Error('boom');
    return n;
  });
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.equal(results[2].status, 'fulfilled');
});

test('withTimeout rejects slow work', async () => {
  await assert.rejects(() => withTimeout(new Promise((r) => setTimeout(r, 100)), 10, 'slow'));
});
