import { config } from 'dotenv';
import path from 'node:path';
import { callStructured, setAiBudgetGate } from '../src/lib/ai/client';
import { comparisonChoice, comparisonInput, fixtureChoice, measureComparison } from '../src/app/modules/finance/agents/comparison';
import { digest, saveEvidence, serverRoot } from './evidence-output';
import { benchmarkSummary } from './cli-report';

async function main() {
  const args = process.argv.slice(2);
  if (args.some(a => a !== '--live')) throw new Error('Usage: npm run benchmark:finance -- [--live]');
  const live = args.includes('--live');
  if (live) config({ path: path.join(serverRoot, '.env.benchmark') });
  if (live && !process.env.OPENAI_API_KEY) throw new Error('Live mode requires OPENAI_API_KEY in server/.env.benchmark or the process environment');
  if (!live) process.env.OPENAI_API_KEY = '';
  process.env.AI_FEATURE_FLAGS = 'agents';
  process.env.OPENAI_MODEL_FAST = 'gpt-4o-mini';
  let reserved = 0;
  const limit = Number(process.env.BENCHMARK_BUDGET_USD ?? '0.10');
  if (!Number.isFinite(limit) || limit <= 0 || limit > 1) throw new Error('BENCHMARK_BUDGET_USD must be greater than 0 and at most 1');
  setAiBudgetGate(async (_tenant, amount) => {
    if (reserved + amount > limit) return null;
    reserved += amount;
    return { settle: async () => {} };
  });
  const cases = [];
  let failed = false;
  for (const risk of [0.05,0.2,0.5]) {
    const input = comparisonInput(risk);
    const started = Date.now();
    const result = await callStructured({
      agentType: 'BORROWER_AGENT', purpose: 'standalone-finance-comparison', promptVersion: 'comparison-v1', tier: 'fast', pillar: 'agents', tenantID: 'synthetic-benchmark',
      system: 'Select a feasible policy for each of four independent sandbox financial roles. Lender: maximize expected return using capped rate baseRate+pd*20 and common expected loss. Borrower: minimize total borrowing cost within maxInstallment. Treasurer: choose debts to collect. Analyst: allocate capital to maximize modeled margin return. Return JSON with lend:boolean, offerID:one offer id, collect:unique debt ids, allocation:three nonnegative weights summing to 1. Never invent ids or change financial inputs.',
      input, outputSchema: comparisonChoice, fallback: () => fixtureChoice(input), subBudgetMs: 20000,
    });
    let comparison;
    let valid = true;
    try { comparison = measureComparison(input,result.data); }
    catch { valid = false; }
    const success = valid && (!live || (!result.usedFallback && result.run.status === 'SUCCESS'));
    if (!success) failed = true;
    cases.push({ inputSha256: digest(input), mode: live ? 'live-provider' : 'fixture-policy-not-AI', success, valid, usedFallback: result.usedFallback, model: result.model, latencyMs: Date.now()-started,
      usage: { inputTokens: result.run.inputTokens, outputTokens: result.run.outputTokens, costUsdEstimate: result.run.costUsd, status: result.run.status }, comparison: comparison ?? null });
  }
  console.log(benchmarkSummary(live,cases));
  saveEvidence('benchmark-results', { mode: live ? 'live-provider' : 'fixture-policy-not-AI', success: !failed, budgetUsdEstimateLimit: limit, costNote: 'Application pricing estimates are not a provider billing guarantee. API cost is USD and is not subtracted from BDT outcomes without an explicit exchange rate.', cases,
    limitations: 'Standalone policy selection over synthetic independent role models, not a replay of the application multi-agent negotiation pipeline, not a full economic backtest, not application scorecard alpha and not proof of real-world improvement. Fixture mode makes no AI-quality claim. All three risk cases are preserved, including failures.' });
  if (failed) process.exitCode = 1;
}
main().catch(() => { console.error('Benchmark failed. Check documented configuration and provider access; credentials and raw provider errors are not logged.'); process.exitCode = 1; });
