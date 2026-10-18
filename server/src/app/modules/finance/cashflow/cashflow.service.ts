/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '../../../../shared/prisma';
import { callStructured, hashInput } from '../../../../lib/ai/client';
import * as prompts from '../../../../lib/ai/prompts';
import { roundCurrency, sumMoney } from '../shared/money';
import { buildProfile } from '../shared/metricEngine';
import { dailyNetSeries, buildProjection } from '../shared/cashEngine';
import { evaluateAlerts, buildActionMenu } from '../shared/alerts';
import { guardTreasuryActions } from '../shared/guard';
import { loadProfileAggregates, loadOpenDebts, loadCashTransactions, assertShop } from '../shared/shopData';
import { ensureDefaultPolicies } from '../shared/catalog';

const db = () => prisma as any;
const DAY = 86400000;

export async function ensureAccounts(tenantId: string, shopId: string) {
  let accounts = await db().cashAccount.findMany({ where: { tenantID: tenantId, shopID: shopId, isActive: true } });
  if (!accounts.length) {
    const defaults = [
      { name: 'Daily Cash Box', accountType: 'CASH', isPrimary: true },
      { name: 'bKash Merchant', accountType: 'EWALLET', isPrimary: false },
      { name: 'Bank Account', accountType: 'BANK', isPrimary: false },
    ];
    for (const d of defaults)
      await db().cashAccount.create({ data: { tenantID: tenantId, shopID: shopId, openingBalance: 0, currentBalance: 0, ...d } });
    accounts = await db().cashAccount.findMany({ where: { tenantID: tenantId, shopID: shopId, isActive: true } });
  }
  return accounts;
}

export async function refreshBalances(tenantId: string, shopId: string) {
  const accounts = await ensureAccounts(tenantId, shopId);
  const txns = await db().cashTransaction.findMany({ where: { tenantID: tenantId, shopID: shopId, status: 'CLEARED' }, select: { accountID: true, direction: true, amount: true } });
  for (const a of accounts) {
    let bal = roundCurrency(a.openingBalance);
    for (const t of txns.filter((x: any) => x.accountID === a.id))
      bal = roundCurrency(bal + (t.direction === 'IN' ? t.amount : -t.amount)); // per-step rounding (§2.2)
    await db().cashAccount.update({ where: { id: a.id }, data: { currentBalance: bal } });
    a.currentBalance = bal;
  }
  return accounts;
}

export const cashflowService = {
  async listAccounts(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    const accounts = await refreshBalances(tenantId, shopId);
    return { accounts, totalCash: sumMoney(accounts.map((a: any) => a.currentBalance)) };
  },

  async createAccount(tenantId: string, shopId: string, body: any) {
    await assertShop(tenantId, shopId);
    return db().cashAccount.create({
      data: {
        tenantID: tenantId, shopID: shopId, name: body.name,
        accountType: body.accountType ?? 'CASH', currency: body.currency ?? 'BDT',
        openingBalance: roundCurrency(body.openingBalance ?? 0),
        currentBalance: roundCurrency(body.openingBalance ?? 0),
        isPrimary: Boolean(body.isPrimary),
      },
    });
  },

  async listTransactions(tenantId: string, shopId: string, query: any) {
    await assertShop(tenantId, shopId);
    const take = Math.min(200, Number(query.limit ?? 50));
    const skip = Math.max(0, (Number(query.page ?? 1) - 1) * take);
    const where: any = { tenantID: tenantId, shopID: shopId };
    if (query.from || query.to) where.occurredAt = { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) };
    const [rows, total] = await Promise.all([
      db().cashTransaction.findMany({ where, orderBy: { occurredAt: 'desc' }, take, skip }),
      db().cashTransaction.count({ where }),
    ]);
    return { transactions: rows, meta: { page: Number(query.page ?? 1), limit: take, total } };
  },

  async createTransaction(tenantId: string, shopId: string, body: any) {
    await assertShop(tenantId, shopId);
    const accounts = await ensureAccounts(tenantId, shopId);
    const accountID = body.accountID ?? accounts.find((a: any) => a.isPrimary)?.id ?? accounts[0]?.id;
    const row = await db().cashTransaction.create({
      data: {
        tenantID: tenantId, shopID: shopId, accountID,
        direction: body.direction, amount: roundCurrency(Math.abs(body.amount)),
        category: body.category ?? 'OTHER', occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
        description: body.description ?? null, source: 'MANUAL', status: 'CLEARED',
      },
    });
    await refreshBalances(tenantId, shopId);
    return row;
  },

  async recategorize(tenantId: string, shopId: string, id: string) {
    const row = await db().cashTransaction.findFirst({ where: { id, tenantID: tenantId, shopID: shopId } });
    if (!row) throw Object.assign(new Error('Transaction not found'), { statusCode: 404 });
    const result = await callStructured({
      agentType: 'TREASURER_AGENT', purpose: 'categorize_transaction', promptVersion: prompts.categorizeTransaction.version,
      tier: 'fast', pillar: 'cashflow', system: prompts.categorizeTransaction.system, tenantID: tenantId, shopID: shopId,
      input: { description: row.description ?? '', categories: ['SALES_COLLECTION', 'PRODUCT_PURCHASE', 'OPERATING_EXPENSE', 'SALARY', 'RENT', 'UTILITY', 'TAX', 'OWNER_DRAWING', 'OTHER'] },
      outputSchema: prompts.categorizeTransaction.outputSchema,
      fallback: () => {
        const text = (row.description ?? '').toLowerCase();
        const hit = /salary|staff|wage/.test(text) ? 'SALARY' : /rent/.test(text) ? 'RENT' : /electric|water|gas|internet|utility/.test(text) ? 'UTILITY' : /buy|stock|purchase|supplier/.test(text) ? 'PRODUCT_PURCHASE' : /sale|sold/.test(text) ? 'SALES_COLLECTION' : 'OTHER';
        return { category: hit, confidence: 0.6 };
      },
    });
    return db().cashTransaction.update({
      where: { id },
      data: { category: result.data.category as any, aiCategorized: true, categoryConfidence: result.data.confidence },
    });
  },

  async backfill(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    const accounts = await ensureAccounts(tenantId, shopId);
    const primary = accounts.find((a: any) => a.isPrimary) ?? accounts[0];
    await db().cashTransaction.deleteMany({ where: { tenantID: tenantId, shopID: shopId, source: 'BACKFILL' } });
    const raw = db();
    const [sales, payments, expenseItems] = await Promise.all([
      raw.checkout.findMany({ where: { shopID: shopId, tenantID: tenantId, isDraft: false }, select: { id: true, totalPrice: true, createdAt: true, status: true } }),
      raw.debtPayments.findMany({ where: { debt: { shopID: shopId, tenantID: tenantId } }, select: { id: true, amount: true, createdAt: true } }).catch(() => []),
      raw.expenseItem.findMany({ where: { tenantID: tenantId, expense: { shopID: shopId, tenantID: tenantId } }, select: { id: true, amount: true, expenseType: true, createdAt: true } }).catch(() => []),
    ]);
    const rows: any[] = [];
    for (const s of sales)
      if (s.status !== 'UNPAID')
        rows.push({ tenantID: tenantId, shopID: shopId, accountID: primary.id, direction: 'IN', amount: roundCurrency(s.totalPrice), category: 'SALES_COLLECTION', occurredAt: s.createdAt, source: 'BACKFILL', sourceRefID: s.id, status: 'CLEARED', isBackfilled: true, description: 'Sale collection (backfill)' });
    for (const p of payments)
      rows.push({ tenantID: tenantId, shopID: shopId, accountID: primary.id, direction: 'IN', amount: roundCurrency(p.amount), category: 'INVOICE_PAYMENT', occurredAt: p.createdAt, source: 'BACKFILL', sourceRefID: p.id, status: 'CLEARED', isBackfilled: true, description: 'Debt payment (backfill)' });
    for (const e of expenseItems)
      rows.push({ tenantID: tenantId, shopID: shopId, accountID: primary.id, direction: 'OUT', amount: roundCurrency(e.amount), category: e.expenseType === 'PRODUCT' ? 'PRODUCT_PURCHASE' : e.expenseType === 'EMPLOYEE_SALARY' ? 'SALARY' : 'OPERATING_EXPENSE', occurredAt: e.createdAt, source: 'BACKFILL', sourceRefID: e.id, status: 'CLEARED', isBackfilled: true, description: 'Expense (backfill)' });
    if (rows.length) await db().cashTransaction.createMany({ data: rows });
    // Notes with future due dates become commitments (§5.3[1]).
    const notes = await raw.note.findMany({ where: { shopID: shopId, tenantID: tenantId, isComplete: false, isDeleted: false, dueDate: { gte: new Date() } } }).catch(() => []);
    let commitments = 0;
    for (const n of notes) {
      const amount = Number((String(n.note).match(/([\d,]+(?:\.\d+)?)/) ?? [])[1]?.replace(/,/g, '')) || 0;
      if (!amount) continue;
      const exists = await db().cashCommitment.findFirst({ where: { tenantID: tenantId, shopID: shopId, name: n.name ?? n.note.slice(0, 40), dueDate: n.dueDate } });
      if (exists) continue;
      await db().cashCommitment.create({ data: { tenantID: tenantId, shopID: shopId, name: (n.name ?? n.note.slice(0, 40)) as string, category: 'OPERATING_EXPENSE', amount, dueDate: n.dueDate, recurrence: 'NONE', confidence: 0.8, source: 'IMPORTED_FROM_NOTE', note: n.note } });
      commitments++;
    }
    const refreshed = await refreshBalances(tenantId, shopId);
    const salesTotal = sumMoney(sales.filter((s: any) => s.status !== 'UNPAID').map((s: any) => s.totalPrice));
    const ledgerIn = sumMoney(rows.filter((r) => r.direction === 'IN').map((r) => r.amount));
    return {
      transactionsCreated: rows.length,
      commitmentsCreated: commitments,
      accounts: refreshed,
      reconciliation: { recordedSales: salesTotal, ledgerInflows: ledgerIn, withinOnePercent: salesTotal === 0 ? true : Math.abs(ledgerIn - salesTotal) / Math.max(1, salesTotal) <= 0.01 },
    };
  },

  async getProjection(tenantId: string, shopId: string, horizon = 90, persist = true) {
    await assertShop(tenantId, shopId);
    const accounts = await refreshBalances(tenantId, shopId);
    const currentCash = sumMoney(accounts.map((a: any) => a.currentBalance));
    const txns = await loadCashTransactions(tenantId, shopId, 180);
    const history = dailyNetSeries(txns, 180, new Date());
    const commitments = await db().cashCommitment.findMany({ where: { tenantID: tenantId, shopID: shopId, isPaid: false } }).catch(() => []);
    const debts = await loadOpenDebts(tenantId, shopId);
    const projection = buildProjection({
      openingBalance: currentCash,
      history,
      commitments: commitments.map((c: any) => ({ name: c.name, amount: c.amount, dueDate: c.dueDate, recurrence: c.recurrence, confidence: c.confidence, isPaid: c.isPaid })),
      receivables: debts.map((d) => ({ id: d.id, amount: d.amount, createdAt: d.createdAt })),
      asOf: new Date(),
      horizonDays: horizon,
    });
    let narrative: string | null = null;
    let confidence: number | null = null;
    const narration = await callStructured({
      agentType: 'TREASURER_AGENT', purpose: 'narrate_projection', promptVersion: prompts.narrateProjection.version,
      tier: 'fast', pillar: 'cashflow', system: prompts.narrateProjection.system, tenantID: tenantId, shopID: shopId,
      input: { currentCash, daysOfBuffer: projection.daysOfBuffer, trough: projection.minProjectedBalance, troughDate: projection.troughDate, shortfallDate: projection.shortfallDate, closingBalance: projection.closingBalance },
      outputSchema: prompts.narrateProjection.outputSchema,
      fallback: () => ({
        narrative: projection.shortfallDate
          ? `Cash is projected to go negative on ${projection.shortfallDate}. The lowest point is ৳${Math.round(projection.minProjectedBalance).toLocaleString('en-IN')} on ${projection.troughDate ?? 'the horizon'}. Collect receivables and defer discretionary spending before then.`
          : `Cash stays positive over the next ${horizon} days, ending near ৳${Math.round(projection.closingBalance).toLocaleString('en-IN')} with ${projection.daysOfBuffer} days of buffer.`,
        confidence: 0.7,
      }),
    });
    narrative = narration.data.narrative;
    confidence = narration.data.confidence;
    let saved: any = null;
    if (persist) {
      saved = await db().cashFlowProjection.create({
        data: {
          tenantID: tenantId, shopID: shopId, asOf: new Date(), horizonDays: horizon,
          dailyBuckets: JSON.parse(JSON.stringify(projection.dailyBuckets)),
          expectedInflows: projection.expectedInflows, expectedOutflows: projection.expectedOutflows,
          closingBalance: projection.closingBalance, minProjectedBalance: projection.minProjectedBalance,
          troughDate: projection.troughDate ? new Date(projection.troughDate) : null,
          shortfallDate: projection.shortfallDate ? new Date(projection.shortfallDate) : null,
          shortfallAmount: projection.shortfallAmount, daysOfBuffer: projection.daysOfBuffer,
          method: narration.usedFallback ? 'STATISTICAL' : 'STATISTICAL_AI_ADJUSTED',
          aiNarrative: narrative, aiConfidence: confidence, model: narration.model, promptVersion: prompts.narrateProjection.version,
        },
      }).catch(() => null);
    }
    return { ...projection, currentCash, narrative, confidence, savedID: saved?.id ?? null };
  },

  async runTreasury(tenantId: string, shopId: string, simulation?: { runID: string; occurredAt: Date }) {
    await ensureDefaultPolicies(db());
    const projection = await this.getProjection(tenantId, shopId, 90, true);
    const txns = await loadCashTransactions(tenantId, shopId, 180);
    const history = dailyNetSeries(txns, 180, new Date());
    const avgDailyOutflow = history.length ? roundCurrency(history.slice(-28).reduce((a, h) => a + h.outflow, 0) / Math.min(28, history.length)) : 0;
    const debts = await loadOpenDebts(tenantId, shopId);
    const commitments = await db().cashCommitment.findMany({ where: { tenantID: tenantId, shopID: shopId, isPaid: false, dueDate: { lte: new Date(Date.now() + 3 * DAY) } } }).catch(() => []);
    const aggregates = await loadProfileAggregates(tenantId, shopId, 90);
    const profile = buildProfile(aggregates);
    const revSeries = await loadCashTransactions(tenantId, shopId, 35);
    const revHist = dailyNetSeries(revSeries, 35, new Date());
    const candidateAlerts = evaluateAlerts({
      projection,
      currentCash: projection.currentCash,
      avgDailyOutflow,
      bufferTargetDays: 14,
      openDebts: debts,
      commitmentsDueSoon: commitments.map((c: any) => ({ name: c.name, amount: c.amount, dueDate: new Date(c.dueDate).toISOString().slice(0, 10) })),
      revenue7d: sumMoney(revHist.slice(-7).map((h) => h.inflow)),
      revenue28dAvg: roundCurrency(sumMoney(revHist.slice(-35, -7).map((h) => h.inflow)) / 4),
      largestExpenseRatio: 0,
      ledgerDays: Math.min(180, history.filter((h) => h.inflow + h.outflow > 0).length),
      asOf: new Date(),
    });
    void profile;
    const savedAlerts: any[] = [];
    for (const a of candidateAlerts) {
      const exists = await db().cashAlert.findFirst({ where: { tenantID: tenantId, shopID: shopId, triggerRule: a.triggerRule, status: 'OPEN' } }).catch(() => null);
      if (exists) { savedAlerts.push(exists); continue; }
      const alert = await db().cashAlert.create({
        data: {
          tenantID: tenantId, shopID: shopId, alertType: a.alertType as any, severity: a.severity as any,
          title: a.title, message: a.message, aiNarrative: projection.narrative,
          recommendedActions: JSON.parse(JSON.stringify(a.recommendedActions)),
          triggerRule: a.triggerRule, metricSnapshot: JSON.parse(JSON.stringify(a.metricSnapshot)),
          projectedShortfall: a.projectedShortfall ?? null, status: 'OPEN',
        },
      });
      if (a.severity === 'CRITICAL') {
        const notification = await (prisma as any).notification.create({
          data: { shopId, tenantID: tenantId, title: a.title, body: a.message, data: {
            alertID: alert.id, source: 'finance-copilot',
            ...(simulation ? { simulationRunID: simulation.runID, simulationOccurredAt: simulation.occurredAt.toISOString() } : {}),
          }, role: ['OWNER'], isPublic: false },
        }).catch(() => null);
        if (notification) await db().cashAlert.update({ where: { id: alert.id }, data: { notificationID: notification.id } }).catch(() => undefined);
      }
      savedAlerts.push(alert);
    }
    // Treasury action menu + guard + agent picks (deterministic fallback = greedy by impact).
    const policy = await db().aiAgentPolicy.findFirst({ where: { agentType: 'TREASURER_AGENT', isActive: true }, orderBy: { version: 'desc' } }).catch(() => null);
    const bufferFloor = roundCurrency(14 * avgDailyOutflow);
    const menu = buildActionMenu({
      currentCash: projection.currentCash, bufferFloorAmount: bufferFloor, avgDailyOutflow,
      openDebts: debts, deferrableOutflows: [], annualYieldPct: 8, asOf: new Date(),
    });
    const picks = menu.filter((m) => m.projectedImpact > 0).slice(0, 2);
    const verdict = guardTreasuryActions({
      actions: picks, maxExposure: policy?.maxExposure ?? 500000,
      projectedBalancesAfter: projection.dailyBuckets.map((b) => b.closingBalance), bufferFloorAmount: 0,
    });
    const actions: any[] = [];
    if (policy) {
      for (const pick of verdict.passed ? picks : []) {
        actions.push(await db().treasuryAction.create({
          data: {
            tenantID: tenantId, shopID: shopId, agentPolicyID: policy.id, actionType: pick.actionType as any,
            title: pick.title, rationale: pick.rationale, amount: roundCurrency(pick.amount),
            targetRefID: pick.targetRefID ?? null, expectedDaysToEffect: pick.expectedDaysToEffect,
            projectedImpact: roundCurrency(pick.projectedImpact), status: 'PROPOSED', requiresOwnerApproval: pick.requiresOwnerApproval,
          },
        }));
      }
      await db().aiDecision.create({
        data: {
          tenantID: tenantId, shopID: shopId, agentType: 'TREASURER_AGENT', decisionType: 'TREASURY_RUN',
          action: verdict.passed ? `Proposed ${picks.length} treasury action(s)` : 'Treasury picks blocked by guard',
          rationale: verdict.passed ? picks.map((p) => p.rationale).join(' ') : verdict.reasons.join('; '),
          confidence: 0.75, model: 'deterministic-core', promptVersion: prompts.chooseTreasuryActions.version,
          inputHash: hashInput({ shopId, at: new Date().toISOString().slice(0, 10) }),
          inputSnapshot: { menuSize: menu.length }, output: JSON.parse(JSON.stringify({ picks, verdict })),
          projectedImpact: sumMoney(picks.map((p) => p.projectedImpact)),
          guardResult: verdict.passed ? 'PASSED' : 'REJECTED_BY_GUARD', guardReason: verdict.reasons.join('; ') || null,
          status: verdict.passed ? 'PROPOSED' : 'REJECTED',
        },
      }).catch(() => undefined);
    }
    return { projection, alerts: savedAlerts, treasuryActions: actions, guardPassed: verdict.passed };
  },

  async listAlerts(tenantId: string, shopId: string, status?: string) {
    await assertShop(tenantId, shopId);
    return db().cashAlert.findMany({
      where: { tenantID: tenantId, shopID: shopId, ...(status ? { status: status as any } : {}) },
      orderBy: { createdAt: 'desc' }, take: 50,
    });
  },

  async ackAlert(tenantId: string, shopId: string, id: string, body: any) {
    const alert = await db().cashAlert.findFirst({ where: { id, tenantID: tenantId, shopID: shopId } });
    if (!alert) throw Object.assign(new Error('Alert not found'), { statusCode: 404 });
    const status = body?.action === 'dismiss' ? 'DISMISSED' : body?.action === 'resolve' ? 'RESOLVED' : 'ACKNOWLEDGED';
    return db().cashAlert.update({
      where: { id },
      data: { status: status as any, acknowledgedAt: new Date(), ...(status === 'RESOLVED' ? { resolvedAt: new Date() } : {}), ...(body?.snoozeDays ? { snoozedUntil: new Date(Date.now() + Number(body.snoozeDays) * DAY) } : {}) },
    });
  },

  async executeAlertAction(tenantId: string, shopId: string, id: string, body: any) {
    const alert = await db().cashAlert.findFirst({ where: { id, tenantID: tenantId, shopID: shopId } });
    if (!alert) throw Object.assign(new Error('Alert not found'), { statusCode: 404 });
    await ensureDefaultPolicies(db());
    const policy = await db().aiAgentPolicy.findFirst({ where: { agentType: 'TREASURER_AGENT', isActive: true } });
    const actionType = (body?.actionType as string) ?? 'COLLECT_DEBT';
    const amount = roundCurrency(body?.amount ?? alert.projectedShortfall ?? 0);
    const action = await db().treasuryAction.create({
      data: {
        tenantID: tenantId, shopID: shopId, agentPolicyID: policy?.id ?? 'policy-treasurer-agent',
        actionType: actionType as any, title: body?.title ?? `Act on: ${alert.title}`,
        rationale: `Owner executed a recommended action from alert ${alert.triggerRule}.`,
        amount, projectedImpact: roundCurrency(body?.projectedImpact ?? amount), status: 'EXECUTED',
        requiresOwnerApproval: false, executedAt: new Date(),
      },
    });
    await db().cashAlert.update({ where: { id }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
    return action;
  },

  async listCommitments(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    return db().cashCommitment.findMany({ where: { tenantID: tenantId, shopID: shopId }, orderBy: { dueDate: 'asc' } });
  },

  async createCommitment(tenantId: string, shopId: string, body: any) {
    await assertShop(tenantId, shopId);
    return db().cashCommitment.create({
      data: {
        tenantID: tenantId, shopID: shopId, name: body.name, category: (body.category ?? 'OPERATING_EXPENSE') as any,
        amount: roundCurrency(body.amount), dueDate: new Date(body.dueDate),
        recurrence: (body.recurrence ?? 'NONE') as any, confidence: body.confidence ?? 1,
        source: 'MANUAL', note: body.note ?? null,
      },
    });
  },

  async extractCommitment(tenantId: string, shopId: string, text: string) {
    const result = await callStructured({
      agentType: 'TREASURER_AGENT', purpose: 'extract_commitment', promptVersion: prompts.extractCommitment.version,
      tier: 'fast', pillar: 'cashflow', system: prompts.extractCommitment.system, tenantID: tenantId, shopID: shopId,
      input: { text },
      outputSchema: prompts.extractCommitment.outputSchema,
      fallback: () => {
        const amount = Number((text.match(/([\d,]+(?:\.\d+)?)/) ?? [])[1]?.replace(/,/g, '')) || 0;
        const inDays = Number((text.match(/in\s+(\d+)\s+days/i) ?? [])[1]) || 7;
        const monthly = /monthly|every month|per month/i.test(text);
        return {
          name: text.slice(0, 60), amount, dueDate: new Date(Date.now() + inDays * DAY).toISOString(),
          recurrence: (monthly ? 'MONTHLY' : 'NONE') as 'MONTHLY' | 'NONE', confidence: amount ? 0.65 : 0.3,
        };
      },
    });
    const created = await this.createCommitment(tenantId, shopId, {
      name: result.data.name, amount: result.data.amount, dueDate: result.data.dueDate, recurrence: result.data.recurrence,
    });
    return { extracted: result.data, commitment: created, model: result.model };
  },

  async listTreasuryActions(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    return db().treasuryAction.findMany({ where: { tenantID: tenantId, shopID: shopId }, orderBy: { createdAt: 'desc' }, take: 50 });
  },

  async decideTreasuryAction(tenantId: string, shopId: string, id: string, approve: boolean) {
    const action = await db().treasuryAction.findFirst({ where: { id, tenantID: tenantId, shopID: shopId } });
    if (!action) throw Object.assign(new Error('Action not found'), { statusCode: 404 });
    return db().treasuryAction.update({
      where: { id },
      data: approve ? { status: 'EXECUTED', executedAt: new Date() } : { status: 'REJECTED' },
    });
  },
};
