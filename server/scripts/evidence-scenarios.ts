import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { runMatchedReplay, replayHash } from '../src/app/modules/finance/agents/matchedReplay';
import { digest, saveEvidence, serverRoot } from './evidence-output';

export function evidenceEnvironment(raw: string | undefined) {
  if (!raw) throw new Error('Set EVIDENCE_DATABASE_URL to a disposable local simulator_test database');
  const url = new URL(raw);
  if (!['postgresql:','postgres:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || url.pathname !== '/simulator_test' || [...url.searchParams.keys()].some(k => k !== 'schema'))
    throw new Error('Evidence requires PostgreSQL at 127.0.0.1 with database name simulator_test and no connection overrides');
  const schema = `evidence_${randomUUID().replace(/-/g,'')}`;
  url.searchParams.set('schema',schema);
  return { schema, env: { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test', OPENAI_API_KEY: '', DEMO_EMAIL: '', DEMO_PASSWORD: '',
    GOOGLE_APPLICATION_CREDENTIALS: '', JWT_SECRET: randomUUID(), REFRESH_SECRET: randomUUID(),
    FINANCE_HARDENING_TEST_DATABASE: '1', INVENTORY_TEST_DATABASE: '1', SIMULATOR_TEST_DATABASE: '1', FINANCE_COMPLETION_TEST_DATABASE: '1', MATCHED_EVALUATION_TEST_DATABASE: '1', EMIT_MATCHED_EVIDENCE: '1' } };
}

async function main() {
  const args=process.argv.slice(2);
  if (args.length) {
    if (args.length!==2||args[0]!=='--replay') throw new Error('Usage: npm run evidence:finance -- --replay PATH_TO_EXPORTED_EVALUATION.json');
    if (statSync(args[1]).size>10*1024*1024) throw new Error('Evaluation export exceeds 10 MiB');
    const document=JSON.parse(readFileSync(args[1],'utf8'));
    const exported=document.report??document;
    const outcome=runMatchedReplay(exported.snapshot,exported.choices,exported.seed);
    const success=exported.status==='COMPLETE'&&replayHash(outcome)===replayHash(exported.outcome);
    saveEvidence('matched-replay-verification',{success,evaluationID:exported.id,outcomeHash:replayHash(outcome),scorecards:outcome.scorecards,mode:'saved-sandbox-replay-no-database-or-api'});
    if (!success) process.exitCode=1;
    return;
  }
  const { env, schema } = evidenceEnvironment(process.env.EVIDENCE_DATABASE_URL);
  const operations: unknown[] = [];
  let success = true;
  const steps = [
    { name: 'apply-migrations', args: ['node_modules/prisma/build/index.js','migrate','deploy'] },
    ...['finance-completion','finance-hardening','inventory-finance','simulator-workspace','matched-evaluation'].map(name => ({ name, args: ['node_modules/tsx/dist/cli.mjs','--test','--test-reporter=tap',`tests/${name}.integration.test.ts`] })),
  ];
  for (const step of steps) {
    const start = Date.now();
    const child = spawn(process.execPath,step.args,{ cwd: serverRoot,env,windowsHide:true,stdio:['ignore','pipe','pipe'] });
    let output = '';
    child.stdout.on('data',data => { if (output.length < 500000) output += data.toString(); });
    child.stderr.on('data',data => { if (output.length < 500000) output += data.toString(); });
    const timer = setTimeout(() => child.kill(),180000);
    const code = await new Promise<number | null>((resolve,reject) => { child.once('error',reject); child.once('close',resolve); }).finally(() => clearTimeout(timer));
    // Keep only allowlisted TAP summaries; raw errors can contain database URLs and records.
    const summaries = output.split(/\r?\n/).filter(line => /^(# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) |(?:not )?ok \d+ - )/.test(line));
    const events = output.split(/\r?\n/).flatMap(line => {
      const match = line.match(/^(?:# )?EVIDENCE_EVENT (.+)$/);
      if (!match) return [];
      try {
        const event = JSON.parse(match[1]);
        if (!/^[a-z-]{1,100}$/.test(event.operation) || !Number.isFinite(event.expected) || !Number.isFinite(event.observed) || typeof event.success !== 'boolean') return [];
        return [{ operation: event.operation, expected: event.expected, observed: event.observed, success: event.success }];
      } catch { return []; }
    });
    const skipped = summaries.some(line => /^# skipped [1-9]/.test(line));
    const ok = code === 0 && !skipped && events.every(e => e.success) && (step.name !== 'finance-completion' || events.length >= 6) && (step.name === 'apply-migrations' || summaries.some(line => /^# pass [1-9]/.test(line)));
    operations.push({ name: step.name, command: `node ${step.args.join(' ')}`, success: ok, exitCode: code, durationMs: Date.now()-start, summaries, events, capturedOutputSha256: digest(output) });
    console.log(`${step.name}: ${ok ? 'PASS' : 'FAIL'}${skipped ? ' (skipped scenarios are not accepted as evidence)' : ''}`);
    if (!ok) { success = false; break; }
  }
  saveEvidence('sandbox-operation-logs',{ success, mode: 'local-postgresql-deterministic-services-and-loopback-http', isolation: { host: '127.0.0.1', database: 'simulator_test', schema },
    externalAiCalled: false, operations,
    coverage: ['automatic cash source writes/edits/deletes and rollback','supplier obligations and same-shop recorded purchase evidence','expense-spike alert','tenant/shop permissions and approval gates','matching/negotiation/application schedule','30-day observed capital measurement','isolated demo copy, next-month simulation, locking and reset','shop-specific frozen inputs, paired replay, scoped export and duplicate paid-call protection'],
    limitations: 'Backend service and loopback HTTP integration evidence, not browser/video evidence or live AI evaluation. Failed/skipped runs do not prove completion. Test schema is retained for inspection; never point this at production.' });
  if (!success) process.exitCode = 1;
}
if (require.main === module) {
  main().catch(() => { console.error('Evidence runner failed. Check the local database, migrations and README. Raw connection errors are withheld.'); process.exitCode = 1; });
}
