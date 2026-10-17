import { ageBucket, COLLECTION_PROB } from './cashEngine';
import type { ProjectionResult } from './cashEngine';

/** Deterministic alert rules (PLAN §5.3[4]) — all nine conditions. */
export interface AlertCandidate {
  alertType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  triggerRule: string;
  metricSnapshot: Record<string, unknown>;
  projectedShortfall?: number;
  recommendedActions: Array<{ actionType: string; description: string; projectedImpact: number }>;
}

export interface AlertInputs {
  projection: ProjectionResult;
  currentCash: number;
  avgDailyOutflow: number;
  bufferTargetDays: number;
  openDebts: Array<{ id: string; amount: number; createdAt: Date | string; buyerLabel: string }>;
  commitmentsDueSoon: Array<{ name: string; amount: number; dueDate: string }>;
  revenue7d: number;
  revenue28dAvg: number;
  largestExpenseRatio: number; // largest single expense ÷ category 6-month median
  ledgerDays: number;
  asOf: Date;
}

const fmt = (n: number) => `৳${Math.round(n).toLocaleString('en-IN')}`;

export function evaluateAlerts(i: AlertInputs): AlertCandidate[] {
  const out: AlertCandidate[] = [];
  const p = i.projection;
  if (p.shortfallDate) {
    const daysAway = Math.round(
      (new Date(p.shortfallDate).getTime() - i.asOf.getTime()) / 86400000,
    );
    if (daysAway <= 14)
      out.push({
        alertType: 'SHORTFALL_PREDICTED',
        severity: 'CRITICAL',
        title: 'Cash shortfall predicted',
        message: `Projected cash balance goes negative on ${p.shortfallDate}, short by ${fmt(p.shortfallAmount)}.`,
        triggerRule: 'shortfall_within_14d',
        metricSnapshot: { shortfallDate: p.shortfallDate, shortfallAmount: p.shortfallAmount, daysAway },
        projectedShortfall: p.shortfallAmount,
        recommendedActions: [
          { actionType: 'COLLECT_DEBT', description: 'Collect the oldest open receivables first.', projectedImpact: p.shortfallAmount },
          { actionType: 'DEFER_OUTFLOW', description: 'Defer discretionary purchases until after the trough.', projectedImpact: Math.round(p.shortfallAmount / 2) },
        ],
      });
  }
  if (p.daysOfBuffer < i.bufferTargetDays && i.ledgerDays >= 14)
    out.push({
      alertType: 'BUFFER_BELOW_TARGET',
      severity: 'WARNING',
      title: 'Cash buffer below target',
      message: `You hold ${p.daysOfBuffer} days of cash buffer against a ${i.bufferTargetDays}-day target.`,
      triggerRule: 'buffer_below_target',
      metricSnapshot: { daysOfBuffer: p.daysOfBuffer, bufferTargetDays: i.bufferTargetDays },
      recommendedActions: [
        { actionType: 'COLLECT_DEBT', description: 'Speed up collections to rebuild the buffer.', projectedImpact: Math.round(i.avgDailyOutflow * 3) },
      ],
    });
  for (const c of i.commitmentsDueSoon)
    out.push({
      alertType: 'COMMITMENT_DUE_SOON',
      severity: 'INFO',
      title: `Upcoming: ${c.name}`,
      message: `${c.name} of ${fmt(c.amount)} is due on ${c.dueDate}.`,
      triggerRule: 'commitment_due_soon',
      metricSnapshot: { ...c },
      recommendedActions: [],
    });
  const overdue30 = i.openDebts.filter((d) => ['31-60', '61+'].includes(ageBucket(d.createdAt, i.asOf)));
  const overdue60 = i.openDebts.filter((d) => ageBucket(d.createdAt, i.asOf) === '61+');
  if (overdue60.length)
    out.push({
      alertType: 'DEBT_OVERDUE',
      severity: 'CRITICAL',
      title: `${overdue60.length} receivables overdue 60+ days`,
      message: `${fmt(overdue60.reduce((a, d) => a + d.amount, 0))} has been unpaid for over 60 days.`,
      triggerRule: 'debt_overdue_60d',
      metricSnapshot: { count: overdue60.length },
      recommendedActions: overdue60.slice(0, 3).map((d) => ({
        actionType: 'COLLECT_DEBT',
        description: `Collect ${fmt(d.amount)} from ${d.buyerLabel}.`,
        projectedImpact: Math.round(d.amount * 0.12),
      })),
    });
  else if (overdue30.length)
    out.push({
      alertType: 'DEBT_OVERDUE',
      severity: 'WARNING',
      title: `${overdue30.length} receivables overdue 30+ days`,
      message: `${fmt(overdue30.reduce((a, d) => a + d.amount, 0))} has been unpaid for over 30 days.`,
      triggerRule: 'debt_overdue_30d',
      metricSnapshot: { count: overdue30.length },
      recommendedActions: [],
    });
  if (i.avgDailyOutflow > 0 && i.currentCash > 3 * i.avgDailyOutflow * 7 && i.ledgerDays >= 14)
    out.push({
      alertType: 'LARGE_IDLE_CASH',
      severity: 'INFO',
      title: 'Idle cash could be earning',
      message: `Cash of ${fmt(i.currentCash)} is well above daily spending needs.`,
      triggerRule: 'large_idle_cash',
      metricSnapshot: { currentCash: i.currentCash },
      recommendedActions: [
        { actionType: 'SWEEP_IDLE_CASH', description: 'Sweep idle cash above the buffer floor.', projectedImpact: Math.round(i.currentCash * 0.02) },
      ],
    });
  if (i.revenue28dAvg > 0 && i.revenue7d < 0.8 * i.revenue28dAvg && i.ledgerDays >= 14)
    out.push({
      alertType: 'REVENUE_DECLINE',
      severity: 'WARNING',
      title: 'Revenue declining',
      message: `Last 7 days of revenue (${fmt(i.revenue7d)}) are below 80% of the trailing 28-day average (${fmt(i.revenue28dAvg)}).`,
      triggerRule: 'revenue_decline',
      metricSnapshot: { revenue7d: i.revenue7d, revenue28dAvg: i.revenue28dAvg },
      recommendedActions: [],
    });
  if (i.largestExpenseRatio > 2)
    out.push({
      alertType: 'EXPENSE_SPIKE',
      severity: 'WARNING',
      title: 'Unusual expense spike',
      message: 'A single expense is more than twice the typical size for its category.',
      triggerRule: 'expense_spike',
      metricSnapshot: { largestExpenseRatio: i.largestExpenseRatio },
      recommendedActions: [],
    });
  if (i.ledgerDays < 14)
    out.push({
      alertType: 'NO_DATA',
      severity: 'INFO',
      title: 'Still learning your cash rhythm',
      message: `Only ${i.ledgerDays} days of cash history so far. Projections sharpen after 14 days.`,
      triggerRule: 'no_data',
      metricSnapshot: { ledgerDays: i.ledgerDays },
      recommendedActions: [],
    });
  return out;
}

/* ------------------------- treasury action menu (§5.3[5]) ------------------------ */
export interface MenuAction {
  actionType: string;
  title: string;
  rationale: string;
  amount: number;
  targetRefID?: string;
  expectedDaysToEffect: number;
  projectedImpact: number;
  requiresOwnerApproval: boolean;
}

export function buildActionMenu(input: {
  currentCash: number;
  bufferFloorAmount: number;
  avgDailyOutflow: number;
  openDebts: Array<{ id: string; amount: number; createdAt: Date | string; buyerLabel: string }>;
  deferrableOutflows: Array<{ name: string; amount: number }>;
  annualYieldPct: number;
  asOf: Date;
}): MenuAction[] {
  const menu: MenuAction[] = [];
  const { COLLECTION_PROB } = require('./cashEngine') as typeof import('./cashEngine');
  for (const d of input.openDebts.slice(0, 5)) {
    const prob = COLLECTION_PROB[ageBucket(d.createdAt, input.asOf)] ?? 0.3;
    menu.push({
      actionType: 'COLLECT_DEBT',
      title: `Collect ${`৳${Math.round(d.amount).toLocaleString('en-IN')}`} from ${d.buyerLabel}`,
      rationale: `Receivable aged in bucket ${ageBucket(d.createdAt, input.asOf)}; collection probability ${(prob * 100).toFixed(0)}% within 7 days.`,
      amount: d.amount,
      targetRefID: d.id,
      expectedDaysToEffect: 7,
      projectedImpact: Math.round(d.amount * prob),
      requiresOwnerApproval: true,
    });
  }
  for (const o of input.deferrableOutflows.slice(0, 3))
    menu.push({
      actionType: 'DEFER_OUTFLOW',
      title: `Defer ${o.name}`,
      rationale: 'Discretionary outflow that can slip without stopping sales.',
      amount: o.amount,
      expectedDaysToEffect: 7,
      projectedImpact: Math.round(o.amount * 0.8),
      requiresOwnerApproval: true,
    });
  const idle = Math.max(0, input.currentCash - input.bufferFloorAmount);
  if (idle > 0 && input.annualYieldPct > 0)
    menu.push({
      actionType: 'SWEEP_IDLE_CASH',
      title: `Sweep ৳${Math.round(idle).toLocaleString('en-IN')} idle cash`,
      rationale: `Keeps the ${input.bufferFloorAmount ? 'buffer floor' : 'buffer'} intact and earns ${input.annualYieldPct}% p.a. on the rest.`,
      amount: idle,
      expectedDaysToEffect: 30,
      projectedImpact: Math.round((idle * input.annualYieldPct * 30) / 36500),
      requiresOwnerApproval: true,
    });
  menu.push({
    actionType: 'HOLD_CASH',
    title: 'Hold cash, take no action',
    rationale: 'A legitimate scored decision when no action clears the mandate.',
    amount: 0,
    expectedDaysToEffect: 0,
    projectedImpact: 0,
    requiresOwnerApproval: false,
  });
  return menu.sort((a, b) => b.projectedImpact - a.projectedImpact);
}
