type Measurement = { agent: string; baseline: number; participant: number; differenceInFavourOfParticipant: number };
type BenchmarkCase = { success: boolean; usedFallback: boolean; model: string; latencyMs: number; usage: { costUsdEstimate: number }; comparison: { caseID: string; measurements: Measurement[] } | null };
export type EvidenceOperation = { name: string; success: boolean; durationMs: number; summaries: string[] };
type Scorecard = { agentType: string; baseline: number | null; participant: number | null; alpha: number | null };

const number = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const difference = (n: number) => `${n > 0 ? '+' : ''}${number(n)}`;
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
const role = (name: string) => name.replace(/_AGENT$/, '').toLowerCase();
const count = (operation: EvidenceOperation, key: string) => Number(operation.summaries.find(line => line.startsWith(`# ${key} `))?.split(' ')[2] ?? 0);

function table(headers: string[], rows: string[][]) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(row => row[i].length)));
  const line = (row: string[]) => row.map((cell, i) => cell.padEnd(widths[i])).join('  ').trimEnd();
  return [line(headers), widths.map(w => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

function finish(lines: string[], color: boolean) {
  const text = lines.join('\n') + '\n';
  if (!color) return text;
  return text.replace(/\b(PASS|FAIL|SKIP)\b/g, status => `\x1b[${status === 'PASS' ? 32 : status === 'FAIL' ? 31 : 33}m${status}\x1b[0m`)
    .replace(/^(FINANCE BENCHMARK|EXECUTION EVIDENCE|MATCHED REPLAY VERIFICATION)$/gm, '\x1b[1;36m$1\x1b[0m');
}

export function cliColorEnabled() {
  return !!process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== 'dumb';
}

export function benchmarkSummary(live: boolean, cases: BenchmarkCase[], color = cliColorEnabled()) {
  const participant = live ? 'AI' : 'Fixture';
  const lines = ['', 'FINANCE BENCHMARK', '='.repeat(64),
    `Mode: ${live ? 'Live AI on synthetic inputs' : 'Offline fixture policy (NOT AI)'}`, 'Currency: BDT | API costs: USD estimates', ''];
  let wins = 0, losses = 0, ties = 0;
  for (const [index, item] of cases.entries()) {
    const label = live && item.usedFallback ? 'Fixture fallback' : participant;
    lines.push(`${item.comparison?.caseID ?? `Case ${index + 1}`}  ${item.success ? 'PASS' : 'FAIL'}  | ${item.model} | ${seconds(item.latencyMs)} | USD ${item.usage.costUsdEstimate.toFixed(6)}`);
    if (item.comparison) {
      lines.push(table(['Role', 'Rules', label, 'Difference*', 'Winner'], item.comparison.measurements.map(m => {
        const delta = m.differenceInFavourOfParticipant;
        if (item.success) { if (delta > 0) wins++; else if (delta < 0) losses++; else ties++; }
        return [role(m.agent), number(m.baseline), number(m.participant), difference(delta), item.success ? delta > 0 ? participant : delta < 0 ? 'Rules' : 'Tie' : 'Not counted'];
      })));
    } else lines.push('No valid comparison available. See the saved report status.');
    lines.push('');
  }
  const passed = cases.filter(c => c.success).length;
  lines.push(`Cases: ${passed}/${cases.length} PASS | ${cases.length - passed} FAIL`,
    `Valid comparisons: ${participant} wins ${wins} | Rules wins ${losses} | Ties ${ties}`,
    `Estimated API cost: USD ${cases.reduce((sum, c) => sum + c.usage.costUsdEstimate, 0).toFixed(6)}`,
    '* Positive difference favours the participant; lower borrowing cost is better.',
    'Metrics: lender net return; borrower cost; treasurer gross collections; analyst modeled return.',
    'Win counts are not a combined financial score. Failed cases are excluded from counts.',
    'Synthetic models only; not proof of real-world improvement. Full details in JSON.');
  return finish(lines, color);
}

export function evidenceSummary(success: boolean, operations: EvidenceOperation[], totalSteps: number, color = cliColorEnabled()) {
  const rows = operations.map(op => [op.name, op.success ? 'PASS' : 'FAIL',
    op.name === 'apply-migrations' ? '-' : String(count(op, 'pass')),
    op.name === 'apply-migrations' ? '-' : String(count(op, 'fail')),
    op.name === 'apply-migrations' ? '-' : String(count(op, 'skipped')), seconds(op.durationMs)]);
  return finish(['', 'EXECUTION EVIDENCE', '='.repeat(64),
    'Mode: isolated local PostgreSQL | External AI: disabled', '',
    table(['Step', 'Status', 'Passed', 'Failed', 'Skipped', 'Time'], rows), '',
    `Overall: ${success ? 'PASS' : 'FAIL'} | Steps passed: ${operations.filter(o => o.success).length}/${totalSteps} | Not run: ${totalSteps - operations.length}`,
    `Tests: ${operations.reduce((n, op) => n + count(op, 'pass'), 0)} passed | ${operations.reduce((n, op) => n + count(op, 'fail'), 0)} failed | ${operations.reduce((n, op) => n + count(op, 'skipped'), 0)} skipped | ${operations.reduce((n, op) => n + count(op, 'cancelled'), 0)} cancelled`,
    `Total step time: ${seconds(operations.reduce((n, op) => n + op.durationMs, 0))}`,
    'Skipped scenarios are not accepted as evidence. Failed runs retain a nonzero exit code.',
    'Service/HTTP evidence only; not production, browser or real-world financial proof.'], color);
}

export function replaySummary(success: boolean, scorecards: Scorecard[], color = cliColorEnabled()) {
  const value = (n: number | null) => n === null ? 'Pending' : number(n);
  return finish(['', 'MATCHED REPLAY VERIFICATION', '='.repeat(64),
    `Outcome hash match: ${success ? 'PASS' : 'FAIL'} | Database/API: not required`, '',
    table(['Role', 'Baseline (BDT)', 'Participant (BDT)', 'Difference*'], scorecards.map(s =>
      [role(s.agentType), value(s.baseline), value(s.participant), s.alpha === null ? 'Pending' : difference(s.alpha)])), '',
    '* Recomputed sandbox values; positive differences favour the participant.',
    'Different role metrics must not be summed. Hash matching proves reproducibility, not authorship or real-world benefit.'], color);
}
