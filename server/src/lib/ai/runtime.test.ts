import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { z } from 'zod';
import { callStructured, redactPII, hashInput, setAiRunSink, recentRuns, setAiBudgetGate, aiEnabled } from './client';

beforeEach(() => setAiBudgetGate(async () => ({ settle: async () => {} })));
afterEach(() => { setAiBudgetGate(null); delete process.env.OPENAI_API_KEY; delete process.env.AI_FEATURE_FLAGS; });

const schema = z.object({ ok: z.boolean(), label: z.string() });

test('offline (no API key) resolves through the deterministic fallback and logs the run', async () => {
  delete process.env.OPENAI_API_KEY;
  const before = recentRuns.length;
  const result = await callStructured({
    tenantID: 'fixture', agentType: 'TEST', purpose: 'unit', promptVersion: 'v1', tier: 'fast',
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
    tenantID: 'fixture', agentType: 'TEST', purpose: 'unit', promptVersion: 'v1', tier: 'fast',
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
    tenantID: 'fixture', agentType: 'TEST', purpose: 'unit', promptVersion: 'v1', tier: 'fast',
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
  assert.equal(redactPII({ buyerName: 'Fixture', text: 'Reply to fixture@example.invalid' }).buyerName, '[redacted]');
  assert(!redactPII({ text: 'Reply to fixture@example.invalid' }).text.includes('fixture@example.invalid'));
  assert.equal(hashInput({ a: 1 }), hashInput({ a: 1 }));
  setAiRunSink(null);
});

test('default pillar flags enable AI; empty flags disable named pillars', () => {
  process.env.OPENAI_API_KEY = 'fixture';
  delete process.env.AI_FEATURE_FLAGS;
  assert.equal(aiEnabled('matching'), true);
  process.env.AI_FEATURE_FLAGS = '';
  assert.equal(aiEnabled('matching'), false);
});

test('budget denial or failure never sends a model request', async () => {
  process.env.OPENAI_API_KEY = 'fixture';
  let calls = 0;
  const call = { tenantID: 'tenant', agentType: 'TEST', purpose: 'budget', promptVersion: 'v1', tier: 'fast' as const,
    system: 'JSON', input: {}, outputSchema: schema, fallback: () => ({ ok: true, label: 'safe' }), fetchImpl: (async () => { calls++; throw new Error('must not send'); }) as typeof fetch };
  for (const gate of [async () => null, async () => { throw new Error('database unavailable'); }]) {
    setAiBudgetGate(gate);
    const result = await callStructured(call);
    assert.equal(result.usedFallback, true);
    assert.equal(result.run.status, 'GUARD_FAIL');
  }
  assert.equal(calls, 0);
});

test('schema retries count both billed attempts and settle the reservation once', async () => {
  process.env.OPENAI_API_KEY = 'fixture';
  let settled = 0; let cost = 0; let quote = 0; let calls = 0;
  setAiBudgetGate(async (_tenant, amount) => { quote = amount; return { settle: async actual => { settled++; cost = actual; } }; });
  const result = await callStructured({ tenantID: 'tenant', agentType: 'TEST', purpose: 'retry', promptVersion: 'v1', tier: 'fast',
    system: 'JSON', input: {}, outputSchema: schema, fallback: () => ({ ok: true, label: 'safe' }),
    fetchImpl: (async (_url, init) => { calls++; assert.equal(JSON.parse(String(init?.body)).max_completion_tokens, 2048);
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'invalid JSON' } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }) } as Response;
    }) as typeof fetch });
  assert.equal(calls, 2); assert.equal(settled, 1);
  assert.equal(result.run.inputTokens, 200); assert.equal(result.run.outputTokens, 100);
  assert(cost > 0 && cost <= quote); assert.equal(result.run.costUsd, cost);
});
