import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { callStructured, redactPII, hashInput, setAiRunSink, recentRuns } from './client';

const schema = z.object({ ok: z.boolean(), label: z.string() });

test('offline (no API key) resolves through the deterministic fallback and logs the run', async () => {
  delete process.env.OPENAI_API_KEY;
  const before = recentRuns.length;
  const result = await callStructured({
    agentType: 'TEST', purpose: 'unit', promptVersion: 'v1', tier: 'fast',
    system: 'x', input: { a: 1 }, outputSchema: schema,
    fallback: () => ({ ok: true, label: 'fallback' }),
  });
  assert.equal(result.usedFallback, true);
  assert.equal(result.model, 'deterministic-fallback');
  assert.equal(result.data.label, 'fallback');
  assert.ok(recentRuns.length > before);
});

test('invalid model JSON is retried once, then dropped to fallback (never rendered raw)', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  let calls = 0;
  const fakeFetch = (async () => {
    calls++;
    return {
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: 'not json at all' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
    } as Response;
  }) as typeof fetch;
  const result = await callStructured({
    agentType: 'TEST', purpose: 'unit', promptVersion: 'v1', tier: 'fast',
    system: 'x', input: { a: 1 }, outputSchema: schema, fetchImpl: fakeFetch,
    fallback: () => ({ ok: true, label: 'safe' }),
  });
  assert.equal(calls, 2); // one retry with the repair prompt
  assert.equal(result.data.label, 'safe');
  delete process.env.OPENAI_API_KEY;
});

test('valid structured output passes schema validation', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  const fakeFetch = (async () => ({
    ok: true, status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify({ ok: true, label: 'model' }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
  }) as unknown) as typeof fetch;
  const result = await callStructured({
    agentType: 'TEST', purpose: 'unit', promptVersion: 'v1', tier: 'fast',
    system: 'x', input: { a: 1 }, outputSchema: schema, fetchImpl: fakeFetch,
    fallback: () => ({ ok: false, label: 'fallback' }),
  });
  assert.equal(result.usedFallback, false);
  assert.equal(result.data.label, 'model');
  delete process.env.OPENAI_API_KEY;
});

test('PII is redacted and input hashing is stable', () => {
  const redacted = redactPII({ buyer_name: 'Karim', metrics: { revenue: 100 }, list: [{ phone: '0171', amount: 5 }] });
  assert.equal((redacted as { buyer_name: string }).buyer_name, '[redacted]');
  assert.equal(hashInput({ a: 1 }), hashInput({ a: 1 }));
  setAiRunSink(null);
});
