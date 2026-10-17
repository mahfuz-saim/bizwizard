/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '../../../../shared/prisma';
import { setAiRunSink } from '../../../../lib/ai/client';
import { cashflowService } from '../cashflow/cashflow.service';
import { roundCurrency } from '../shared/money';

/**
 * Daily finance jobs (PLAN §5.2, §5.3 reconciliation, §4.3[9]):
 *  - 06:00 treasury run per shop (projection → alerts → guarded actions)
 *  - overdue installment marking
 *  - treasury reconciliation (projected vs realized, 7+ days after execution)
 * Everything is per-shop isolated: one failing shop never blocks the rest,
 * and nothing here runs at import time.
 */
const db = () => prisma as any;
const DAY = 86400000;

export function installAiRunSink(): void {
  setAiRunSink(async (run) => {
    await db().aiRun.create({
      data: {
        tenantID: run.tenantID ?? null,
        shopID: run.shopID ?? null,
        agentType: run.agentType,
        purpose: run.purpose,
        model: run.model,
        promptVersion: run.promptVersion,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        costUsd: run.costUsd,
        latencyMs: run.latencyMs,
        status: run.status as any,
        retryCount: run.retryCount,
        error: run.error ?? null,
      },
    });
  });
}

export async function markOverdueInstallments(): Promise<number> {
  const res = await db().loanSchedule.updateMany({
    where: { status: { in: ['DUE', 'PARTIAL'] }, dueDate: { lt: new Date() } },
    data: { status: 'OVERDUE' },
  }).catch(() => ({ count: 0 }));
  return res.count ?? 0;
}

export async function reconcileTreasuryActions(): Promise<number> {
  const due = await db().treasuryAction.findMany({
    where: { status: 'EXECUTED', executedAt: { lt: new Date(Date.now() - 7 * DAY) } },
    take: 100,
  }).catch(() => []);
  let reconciled = 0;
  for (const action of due) {
    let realized = 0;
    if (action.actionType === 'COLLECT_DEBT' && action.targetRefID) {
      const debt = await db().debt.findUnique({ where: { id: action.targetRefID }, select: { paidAmount: true, status: true } }).catch(() => null);
      if (debt) realized = roundCurrency(Math.min(action.projectedImpact, debt.paidAmount ?? 0));
    } else if (action.actionType === 'SWEEP_IDLE_CASH') {
      realized = roundCurrency(action.projectedImpact); // simulated yield, owner-approved (§12)
    } else {
      realized = roundCurrency(action.projectedImpact);
    }
    await db().treasuryAction.update({
      where: { id: action.id },
      data: { realizedImpact: realized, status: 'RECONCILED', reconciledAt: new Date() },
    }).catch(() => undefined);
    await db().aiDecision.updateMany({
      where: { tenantID: action.tenantID, shopID: action.shopID, agentType: 'TREASURER_AGENT', status: 'EXECUTED' },
      data: { realizedImpact: realized, status: 'RECONCILED', reconciledAt: new Date() },
    }).catch(() => undefined);
    reconciled++;
  }
  return reconciled;
}

export async function runDailyFinanceJobs(): Promise<{ shops: number; overdue: number; reconciled: number }> {
  const overdue = await markOverdueInstallments();
  const reconciled = await reconcileTreasuryActions();
  const shops = await db().shop.findMany({ select: { id: true, tenantID: true }, take: 100 }).catch(() => []);
  let done = 0;
  for (const shop of shops) {
    try {
      await cashflowService.runTreasury(shop.tenantID, shop.id);
      done++;
    } catch {
      /* a single shop must never break the daily run */
    }
  }
  return { shops: done, overdue, reconciled };
}
