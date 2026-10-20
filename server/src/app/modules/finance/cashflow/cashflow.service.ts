/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma, { shopClock, simulationContext, simulationCashRows } from '../shared/database';
import { callStructured, hashInput } from '../../../../lib/ai/client';
import * as prompts from '../../../../lib/ai/prompts';
import { roundCurrency, sumMoney } from '../shared/money';
import { dailyNetSeries, buildProjection } from '../shared/cashEngine';
import { evaluateAlerts, buildActionMenu } from '../shared/alerts';
import { guardTreasuryActions } from '../shared/guard';
import { loadOpenDebts, loadCashTransactions, assertShop } from '../shared/shopData';
import { ensureDefaultPolicies } from '../shared/catalog';
import ApiError from '../../../../errors/ApiError';
import { expenseSpikeRatio } from '../shared/expenseSpike';

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
  const ledger = simulationCashRows(tenantId, shopId);
  const txns = ledger ? ledger.filter(row => row.status === 'CLEARED')
    : await db().cashTransaction.findMany({ where: { tenantID: tenantId, shopID: shopId, status: 'CLEARED' }, select: { accountID: true, direction: true, amount: true } });
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
    if (!accounts.some((a: any) => a.id === accountID)) throw new ApiError(400, 'Choose an active account in this shop');
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
    const synchronize = async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM shops WHERE id = ${shopId} AND "tenantID" = ${tenantId} FOR UPDATE`;
      const [sales, payments, expenses] = await Promise.all([
        tx.checkout.findMany({ where: { tenantID: tenantId, shopID: shopId, isSimulated: false }, select: { id: true } }),
        tx.debtPayments.findMany({ where: { debt: { tenantID: tenantId, shopID: shopId }, isSimulated: false }, select: { id: true } }),
        tx.expenseItem.findMany({ where: { tenantID: tenantId, expense: { shopID: shopId }, isSimulated: false }, select: { id: true } }),
      ]);
      for (const [kind, rows] of [['sale', sales], ['payment', payments], ['expense', expenses]] as const)
        for (const row of rows) await tx.$queryRaw`SELECT finance_sync_event(${kind}::text, ${row.id}::text, true)::text`;
    };
    if (simulationContext.getStore()) await synchronize(db());
    else await db().$transaction(synchronize, { timeout: 120000 });
    const commitmentsCreated = await this.importNoteCommitments(tenantId, shopId);
    return { accounts: await refreshBalances(tenantId, shopId), synchronized: true, commitmentsCreated };
  },

  async importNoteCommitments(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    const raw = db();
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
    return commitments;
  },

  async getProjection(tenantId: string, shopId: string, horizon = 90, persist = true) {
    const asOf = await shopClock(tenantId, shopId);
    await assertShop(tenantId, shopId);
    const accounts = await refreshBalances(tenantId, shopId);
    const currentCash = sumMoney(accounts.map((a: any) => a.currentBalance));
    const txns = await loadCashTransactions(tenantId, shopId, 180);
    const history = dailyNetSeries(txns, 180, asOf);
    const commitments = await db().cashCommitment.findMany({ where: { tenantID: tenantId, shopID: shopId, isPaid: false } }).catch(() => []);
    const debts = await loadOpenDebts(tenantId, shopId);
    const projection = buildProjection({
      openingBalance: currentCash,
      history,
      commitments: commitments.map((c: any) => ({ name: c.name, amount: c.amount, dueDate: c.dueDate, recurrence: c.recurrence, confidence: c.confidence, isPaid: c.isPaid })),
      receivables: debts.map((d) => ({ id: d.id, amount: d.amount, createdAt: d.createdAt })),
      asOf,
      horizonDays: horizon,
    });
    let narrative: string | null = null;
    let confidence: number | null = null;
    const narrationInput = {
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
    } satisfies Parameters<typeof callStructured>[0];
    const narration = simulationContext.getStore()
      ? { data: narrationInput.fallback(), usedFallback: true, model: 'deterministic-fallback' }
      : await callStructured(narrationInput);
    narrative = narration.data.narrative;
    confidence = narration.data.confidence;
    let saved: any = null;
    if (persist) {
      saved = await db().cashFlowProjection.create({
        data: {
          tenantID: tenantId, shopID: shopId, asOf, horizonDays: horizon,
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
    await assertShop(tenantId, shopId);
    const asOf = simulation?.occurredAt ?? await shopClock(tenantId, shopId);
    await ensureDefaultPolicies(db(), tenantId, shopId);
    const policy = await db().aiAgentPolicy.findFirst({ where: { tenantID: tenantId, shopID: shopId, agentType: 'TREASURER_AGENT', isActive: true }, orderBy: { version: 'desc' } });
    const bufferTargetDays = policy?.bufferTargetDays ?? 14;
    const projection = await this.getProjection(tenantId, shopId, 90, true);
    const txns = await loadCashTransactions(tenantId, shopId, 180);
    const history = dailyNetSeries(txns, 180, asOf);
    const avgDailyOutflow = history.length ? roundCurrency(history.slice(-28).reduce((a, h) => a + h.outflow, 0) / Math.min(28, history.length)) : 0;
    const debts = await loadOpenDebts(tenantId, shopId);
    const commitments = await db().cashCommitment.findMany({ where: { tenantID: tenantId, shopID: shopId, isPaid: false, dueDate: { lte: new Date(asOf.getTime() + 3 * DAY) } } }).catch(() => []);
    const revSeries = await loadCashTransactions(tenantId, shopId, 35);
    const revHist = dailyNetSeries(revSeries, 35, asOf);
    const recentExpenses = await db().expenseItem.findMany({
      where: { tenantID: tenantId, expense: { shopID: shopId }, createdAt: { gt: new Date(asOf.getTime() - 180 * DAY), lte: asOf } },
      select: { amount: true, expenseType: true, createdAt: true },
    });
    const candidateAlerts = evaluateAlerts({
      projection,
      currentCash: projection.currentCash,
      avgDailyOutflow,
      bufferTargetDays,
      openDebts: debts,
      commitmentsDueSoon: commitments.map((c: any) => ({ name: c.name, amount: c.amount, dueDate: new Date(c.dueDate).toISOString().slice(0, 10) })),
      revenue7d: sumMoney(revHist.slice(-7).map((h) => h.inflow)),
      revenue28dAvg: roundCurrency(sumMoney(revHist.slice(-35, -7).map((h) => h.inflow)) / 4),
      largestExpenseRatio: expenseSpikeRatio(recentExpenses, asOf),
      ledgerDays: Math.min(180, history.filter((h) => h.inflow + h.outflow > 0).length),
      asOf,
    });
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
          ...(simulation ? { isSimulated: true, simulationRunID: simulation.runID } : {}),
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
    const bufferFloor = roundCurrency(bufferTargetDays * avgDailyOutflow);
    const menu = buildActionMenu({
      currentCash: projection.currentCash, bufferFloorAmount: bufferFloor, avgDailyOutflow,
      openDebts: debts, deferrableOutflows: [], annualYieldPct: 8, asOf,
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
            ...(simulation ? { isSimulated: true, simulationRunID: simulation.runID } : {}),
          },
        }));
      }
      await db().aiDecision.create({
        data: {
          tenantID: tenantId, shopID: shopId, agentType: 'TREASURER_AGENT', decisionType: 'TREASURY_RUN',
          action: verdict.passed ? `Proposed ${picks.length} treasury action(s)` : 'Treasury picks blocked by guard',
          rationale: verdict.passed ? picks.map((p) => p.rationale).join(' ') : verdict.reasons.join('; '),
          confidence: 0.75, model: 'deterministic-core', promptVersion: prompts.chooseTreasuryActions.version,
          inputHash: hashInput({ shopId, at: asOf.toISOString().slice(0, 10) }),
          inputSnapshot: { menuSize: menu.length }, output: JSON.parse(JSON.stringify({ picks, verdict })),
          projectedImpact: sumMoney(picks.map((p) => p.projectedImpact)),
          guardResult: verdict.passed ? 'PASSED' : 'REJECTED_BY_GUARD', guardReason: verdict.reasons.join('; ') || null,
          status: verdict.passed ? 'PROPOSED' : 'REJECTED',
          ...(simulation ? { isSimulated: true, simulationRunID: simulation.runID } : {}),
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
    await assertShop(tenantId, shopId);
    await ensureDefaultPolicies(db(), tenantId, shopId);
    return db().$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM cash_alerts WHERE id = ${id} AND "tenantID" = ${tenantId} AND "shopID" = ${shopId} FOR UPDATE`;
      const alert = await tx.cashAlert.findFirst({ where: { id, tenantID: tenantId, shopID: shopId } });
      if (!alert) throw new ApiError(404, 'Alert not found');
      if (!['OPEN', 'ACKNOWLEDGED'].includes(alert.status)) throw new ApiError(409, 'This alert is no longer active');
      const recommendation = alert.recommendedActions?.[body.actionIndex];
      if (!recommendation) throw new ApiError(400, 'Choose an available alert recommendation');
      const targetRefID = `${id}:${body.actionIndex}`;
      const existing = await tx.treasuryAction.findFirst({ where: { tenantID: tenantId, shopID: shopId, targetRefID, status: { in: ['PROPOSED', 'APPROVED'] } } });
      if (existing) return existing;
      const policy = await tx.aiAgentPolicy.findFirst({ where: { tenantID: tenantId, shopID: shopId, agentType: 'TREASURER_AGENT', isActive: true } });
      return tx.treasuryAction.create({ data: {
        tenantID: tenantId, shopID: shopId, agentPolicyID: policy.id,
        actionType: recommendation.actionType, title: `Review: ${recommendation.description}`,
        rationale: `Recommended by alert: ${alert.title}. Approval records intent only; complete and record the actual business transaction separately.`,
        amount: 0, projectedImpact: roundCurrency(recommendation.projectedImpact), status: 'PROPOSED',
        targetRefID, requiresOwnerApproval: true,
      } });
    });
  },

  async listCommitments(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    const rows = await db().cashCommitment.findMany({ where: { tenantID: tenantId, shopID: shopId, isPaid: false }, orderBy: { dueDate: 'asc' } });
    const purchases = await db().expenseItem.findMany({ where: { tenantID: tenantId, expense: { shopID: shopId }, expenseType: 'PRODUCT', isSimulated: false }, select: { id: true, name: true, amount: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 200 });
    const linked = await db().cashCommitment.findMany({ where: { tenantID: tenantId, shopID: shopId, paymentExpenseID: { not: null } }, select: { paymentExpenseID: true } });
    const used = new Set(linked.map((r: any) => r.paymentExpenseID));
    return rows.map((row: any) => ({ ...row, paymentCandidates: row.supplierPayable ? purchases.filter((p: any) => !used.has(p.id) && p.createdAt >= row.createdAt && roundCurrency(p.amount) === roundCurrency(row.amount)) : [] }));
  },

  async createCommitment(tenantId: string, shopId: string, body: any) {
    await assertShop(tenantId, shopId);
    if (body.supplierPayable && body.recurrence && body.recurrence !== 'NONE') throw new ApiError(400, 'Record supplier invoices individually, not as recurring forecasts');
    return db().cashCommitment.create({
      data: {
        tenantID: tenantId, shopID: shopId, name: body.name, category: body.supplierPayable ? 'PRODUCT_PURCHASE' : (body.category ?? 'OPERATING_EXPENSE') as any,
        supplierPayable: body.supplierPayable === true,
        amount: roundCurrency(body.amount), dueDate: new Date(body.dueDate),
        recurrence: (body.recurrence ?? 'NONE') as any, confidence: body.confidence ?? 1,
        source: 'MANUAL', note: body.note ?? null,
      },
    });
  },

  async settleCommitment(tenantId: string, shopId: string, id: string, expenseItemID: string) {
    await assertShop(tenantId, shopId);
    return db().$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM cash_commitments WHERE id = ${id} AND "tenantID" = ${tenantId} AND "shopID" = ${shopId} FOR UPDATE`;
      const row = await tx.cashCommitment.findFirst({ where: { id, tenantID: tenantId, shopID: shopId, supplierPayable: true } });
      if (!row) throw new ApiError(404, 'Supplier obligation not found');
      if (row.isPaid) {
        if (row.paymentExpenseID !== expenseItemID) throw new ApiError(409, 'This obligation already has payment evidence');
        return row;
      }
      await tx.$queryRaw`SELECT id FROM expense_item WHERE id = ${expenseItemID} FOR UPDATE`;
      const expense = await tx.expenseItem.findFirst({ where: { id: expenseItemID, tenantID: tenantId, expense: { shopID: shopId }, expenseType: 'PRODUCT', isSimulated: false, createdAt: { gte: row.createdAt } } });
      if (!expense || roundCurrency(expense.amount) !== roundCurrency(row.amount)) throw new ApiError(400, 'Link an actual same-shop purchase recorded after this obligation, with the same amount');
      if (await tx.cashCommitment.findFirst({ where: { paymentExpenseID: expenseItemID } })) throw new ApiError(409, 'This purchase is already linked');
      return tx.cashCommitment.update({ where: { id }, data: { isPaid: true, paidAt: expense.createdAt, paymentExpenseID: expenseItemID } });
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
    if (action.status !== 'PROPOSED') throw new ApiError(409, 'Only proposed actions can be approved or rejected');
    return db().treasuryAction.update({
      where: { id, status: 'PROPOSED' },
      data: { status: approve ? 'APPROVED' : 'REJECTED', ...(approve ? { approvedAt: new Date() } : {}) },
    });
  },

  async collectionEvidence(tenantId: string, shopId: string, id: string) {
    const action = await db().treasuryAction.findFirst({ where: { id, tenantID: tenantId, shopID: shopId, actionType: 'COLLECT_DEBT', status: 'APPROVED' } });
    if (!action?.approvedAt) throw new ApiError(409, 'Approve a collection plan before linking evidence');
    const used = await db().treasuryActionEvidence.findMany({ where: { tenantID: tenantId, shopID: shopId }, select: { paymentID: true } });
    return db().debtPayments.findMany({ where: {
      debt: { tenantID: tenantId, shopID: shopId, ...(action.targetRefID && !action.targetRefID.includes(':') ? { id: action.targetRefID } : {}) },
      id: { notIn: used.map((e: any) => e.paymentID) }, createdAt: { gte: action.approvedAt }, isSimulated: false, amount: { gt: 0 },
    }, select: { id: true, amount: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 50 });
  },

  async recordCollection(tenantId: string, shopId: string, id: string, paymentID: string) {
    return db().$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM treasury_actions WHERE id = ${id} AND "tenantID" = ${tenantId} AND "shopID" = ${shopId} FOR UPDATE`;
      const action = await tx.treasuryAction.findFirst({ where: { id, tenantID: tenantId, shopID: shopId, actionType: 'COLLECT_DEBT', status: 'APPROVED' } });
      if (!action?.approvedAt) throw new ApiError(409, 'Only an approved collection plan can be completed');
      const payment = await tx.debtPayments.findFirst({ where: { id: paymentID,
        debt: { tenantID: tenantId, shopID: shopId, ...(action.targetRefID && !action.targetRefID.includes(':') ? { id: action.targetRefID } : {}) },
        createdAt: { gte: action.approvedAt }, isSimulated: false, amount: { gt: 0 },
      } });
      if (!payment) throw new ApiError(400, 'Choose a real payment recorded after this plan was approved');
      const claimed = await tx.treasuryActionEvidence.findUnique({ where: { paymentID } });
      if (claimed) throw new ApiError(409, 'This payment is already linked to a completed action');
      await tx.treasuryActionEvidence.create({ data: { tenantID: tenantId, shopID: shopId, actionID: id, paymentID, amount: roundCurrency(payment.amount) } });
      await tx.aiDecision.create({ data: { tenantID: tenantId, shopID: shopId, agentType: 'TREASURER_AGENT', decisionType: 'COLLECTION_EVIDENCE',
        action: action.title, rationale: 'Owner linked a recorded debt payment. This is observed cash collection, not incremental profit or causal alpha.',
        confidence: 1, model: 'deterministic-core', promptVersion: 'collection-evidence-v1',
        inputHash: hashInput({ id, paymentID }), inputSnapshot: { treasuryActionID: id, paymentID }, output: { amount: payment.amount },
        projectedImpact: action.projectedImpact, realizedImpact: roundCurrency(payment.amount), guardResult: 'NO_GUARD_REQUIRED', status: 'RECONCILED', reconciledAt: new Date(),
      } });
      return tx.treasuryAction.update({ where: { id }, data: { realizedImpact: roundCurrency(payment.amount), status: 'RECONCILED', executedAt: payment.createdAt, reconciledAt: new Date() } });
    });
  },
};
