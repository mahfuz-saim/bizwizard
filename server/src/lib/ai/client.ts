import { createHash } from 'crypto';
import type { z } from 'zod';

/**
 * AI participant runtime (PLAN §7). Deterministic-first: when no
 * OPENAI_API_KEY is configured (or a pillar kill-switch is off), every call
 * resolves through the caller's deterministic `fallback`, so the product is
 * fully functional offline and the LLM only ever selects/explains — it never
 * computes a number the system cannot reproduce.
 */
export interface AiRunRecord {
  agentType: string;
  purpose: string;
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  status: 'SUCCESS' | 'SCHEMA_FAIL' | 'GUARD_FAIL' | 'TIMEOUT' | 'RATE_LIMIT';
  retryCount: number;
  error?: string;
  tenantID?: string | null;
  shopID?: string | null;
  createdAt: Date;
}

type RunSink = (run: AiRunRecord) => Promise<void> | void;
let runSink: RunSink | null = null;
export type AiBudgetGate = (tenantID: string, maxCostUsd: number) => Promise<{ settle: (actualCostUsd: number) => Promise<void> } | null>;
let budgetGate: AiBudgetGate | null = null;
export function setAiBudgetGate(gate: AiBudgetGate | null) { budgetGate = gate; }
export const recentRuns: AiRunRecord[] = [];
export function setAiRunSink(sink: RunSink | null): void {
  runSink = sink;
}
async function record(run: AiRunRecord): Promise<void> {
  recentRuns.unshift(run);
  if (recentRuns.length > 500) recentRuns.pop();
  try {
    await runSink?.(run);
  } catch {
    /* logging must never break a feature */
  }
}

export function aiConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY || '',
    modelFast: process.env.OPENAI_MODEL_FAST || 'gpt-4o-mini',
    modelReasoning: process.env.OPENAI_MODEL_REASONING || 'gpt-4.1',
    modelEmbedding: process.env.OPENAI_MODEL_EMBEDDING || 'text-embedding-3-small',
    monthlyBudgetUsd: Number.isFinite(Number(process.env.AI_PLAN_BUDGET_USD ?? 2)) ? Math.max(0, Number(process.env.AI_PLAN_BUDGET_USD ?? 2)) : 0,
    flags: (process.env.AI_FEATURE_FLAGS ?? 'matching,cashflow,analysis,agents')
      .split(',')
      .map((s) => s.trim()),
  };
}
export function aiEnabled(pillar?: string): boolean {
  const cfg = aiConfig();
  if (!cfg.apiKey) return false;
  if (pillar && !cfg.flags.includes(pillar) && !cfg.flags.includes('all'))
    return false;
  return true;
}

export const hashInput = (input: unknown): string =>
  createHash('sha256').update(JSON.stringify(input ?? {})).digest('hex');

/** Strip PII before anything leaves the process (PLAN §7.3). */
export function redactPII<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => redactPII(v)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/(name|phone|email|address|number|nid)$/i.test(k) && typeof v === 'string')
        out[k] = '[redacted]';
      else out[k] = redactPII(v);
    }
    return out as T;
  }
  if (typeof value === 'string') return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]').replace(/(?:\+?88)?01[3-9][\d\s-]{8,12}\d/g, '[redacted-phone]') as T;
  return value;
}

const PRICE_PER_1K: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini': { in: 0.00015, out: 0.0006 },
  'gpt-4.1': { in: 0.002, out: 0.008 },
};
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICE_PER_1K[model] ?? { in: 0.001, out: 0.004 };
  return Math.round((inputTokens * p.in + outputTokens * p.out) * 1e6) / 1e6;
}
const roughTokens = (s: string) => Math.ceil(s.length / 4);

export interface StructuredCall<T> {
  agentType: string;
  purpose: string;
  promptVersion: string;
  tier: 'fast' | 'reasoning';
  pillar?: string;
  system: string;
  input: unknown;
  outputSchema: z.ZodType<T>;
  /** Deterministic result used offline / on any AI failure. Required. */
  fallback: () => T | Promise<T>;
  subBudgetMs?: number;
  tenantID?: string | null;
  shopID?: string | null;
  /** Injectable for tests — defaults to global fetch. */
  fetchImpl?: typeof fetch;
  postProcess?: (data: T) => T;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  inputHash: string;
  usedFallback: boolean;
  run: AiRunRecord;
}

/**
 * One structured LLM call with schema validation, one repair retry, a hard
 * sub-budget timeout, AiRun logging, and deterministic degradation. A failed
 * or invalid model response is dropped — never parsed loosely, never shown raw.
 */
export async function callStructured<T>(call: StructuredCall<T>): Promise<StructuredResult<T>> {
  const started = Date.now();
  const inputHash = hashInput(call.input);
  const cfg = aiConfig();
  const model = call.tier === 'reasoning' ? cfg.modelReasoning : cfg.modelFast;
  const subBudget = call.subBudgetMs ?? (call.tier === 'reasoning' ? 12000 : 6000);
  const deadline = started + subBudget;
  let reservation: Awaited<ReturnType<AiBudgetGate>> = null;
  let totalInput = 0;
  let totalOutput = 0;
  let charge = 0;
  const finish = async (
    data: T,
    usedModel: string,
    usedFallback: boolean,
    status: AiRunRecord['status'],
    retryCount: number,
    error?: string,
    inTok = 0,
    outTok = 0,
  ): Promise<StructuredResult<T>> => {
    const run: AiRunRecord = {
      agentType: call.agentType,
      purpose: call.purpose,
      model: usedModel,
      promptVersion: call.promptVersion,
      inputTokens: totalInput || inTok,
      outputTokens: totalOutput || outTok,
      costUsd: charge,
      latencyMs: Date.now() - started,
      status,
      retryCount,
      error,
      tenantID: call.tenantID ?? null,
      shopID: call.shopID ?? null,
      createdAt: new Date(),
    };
    if (reservation) {
      try { await reservation.settle(charge); }
      catch { run.error = 'AI budget settlement unavailable; reservation retained'; }
    }
    await record(run);
    return { data: call.postProcess ? call.postProcess(data) : data, model: usedFallback ? 'deterministic-fallback' : usedModel, inputHash, usedFallback, run };
  };

  if (!aiEnabled(call.pillar)) {
    return finish(await call.fallback(), 'deterministic-fallback', true, 'SUCCESS', 0);
  }

  const fetchImpl = call.fetchImpl ?? fetch;
  const payload = JSON.stringify(redactPII(call.input));
  const maxOutput = 2048;
  const maxInput = Buffer.byteLength(call.system + payload, 'utf8') + 4096;
  const attemptCap = estimateCostUsd(model, maxInput, maxOutput);
  if (!call.tenantID || !budgetGate || !PRICE_PER_1K[model])
    return finish(await call.fallback(), 'deterministic-fallback', true, 'GUARD_FAIL', 0, 'AI disabled: tenant budget or model pricing unavailable');
  try { reservation = await budgetGate(call.tenantID, attemptCap * 2); }
  catch { return finish(await call.fallback(), 'deterministic-fallback', true, 'GUARD_FAIL', 0, 'AI budget check unavailable'); }
  if (!reservation) return finish(await call.fallback(), 'deterministic-fallback', true, 'GUARD_FAIL', 0, 'AI paused: monthly budget reached');
  let lastError = '';
  for (let attempt = 0; attempt <= 1; attempt++) {
    if (Date.now() >= deadline) return finish(await call.fallback(), 'deterministic-fallback', true, 'TIMEOUT', attempt, 'AI deadline reached');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, deadline - Date.now()));
    let usageKnown = false;
    try {
      const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_completion_tokens: maxOutput,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: call.system },
            {
              role: 'user',
              content:
                attempt === 0
                  ? payload
                  : `${payload}\n\nYour previous reply failed validation: ${lastError.slice(0, 1000)}. Reply with valid JSON only.`,
            },
          ],
        }),
      });
      if (res.status === 429) {
        usageKnown = true;
        return finish(await call.fallback(), model, true, 'RATE_LIMIT', attempt, 'rate limited');
      }
      if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const content = json.choices?.[0]?.message?.content ?? '';
      const inputTokens = json.usage?.prompt_tokens ?? maxInput;
      const outputTokens = json.usage?.completion_tokens ?? maxOutput;
      totalInput += inputTokens;
      totalOutput += outputTokens;
      charge += estimateCostUsd(model, inputTokens, outputTokens);
      usageKnown = true;
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        lastError = 'response was not valid JSON';
        continue;
      }
      const validated = call.outputSchema.safeParse(parsed);
      if (!validated.success) {
        lastError = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        if (attempt === 1)
          return finish(await call.fallback(), model, true, 'SCHEMA_FAIL', attempt, lastError,
            json.usage?.prompt_tokens ?? roughTokens(payload), json.usage?.completion_tokens ?? roughTokens(content));
        continue;
      }
      return finish(validated.data, model, false, 'SUCCESS', attempt, undefined,
        json.usage?.prompt_tokens ?? roughTokens(payload), json.usage?.completion_tokens ?? roughTokens(content));
    } catch (err) {
      if (!usageKnown) { charge += attemptCap; usageKnown = true; }
      const isTimeout = controller.signal.aborted || (err instanceof Error && err.name === 'AbortError');
      lastError = isTimeout ? 'AI request timed out' : 'AI request failed';
      if (attempt === 1 || isTimeout)
        return finish(await call.fallback(), model, true, isTimeout ? 'TIMEOUT' : 'SCHEMA_FAIL', attempt, lastError);
    } finally {
      clearTimeout(timer);
    }
  }
  return finish(await call.fallback(), 'deterministic-fallback', true, 'SCHEMA_FAIL', 1, lastError);
}

/** Monthly spend check (PLAN §7.3 budget control). `spentUsd` is DB-supplied. */
export function budgetExceeded(spentUsd: number): boolean {
  return spentUsd >= aiConfig().monthlyBudgetUsd;
}
