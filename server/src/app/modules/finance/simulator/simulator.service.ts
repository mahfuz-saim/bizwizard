/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '../../../../shared/prisma';
import { hashInput } from '../../../../lib/ai/client';
import { roundCurrency, sumMoney } from '../shared/money';
import { dailyNetSeries } from '../shared/cashEngine';
import { assertShop, loadCashTransactions } from '../shared/shopData';
import { ensureCatalog, ensureDefaultPolicies } from '../shared/catalog';
import { ensureAccounts, refreshBalances } from '../cashflow/cashflow.service';
import { cashflowService } from '../cashflow/cashflow.service';
import { agentsService } from '../agents/agents.service';
import {
  seedFromString,
  buildSimulationPlan,
  amplifierTopUp,
  buildAnomalyInsight,
  buildGuardBlockedOfferScenario,
  buildReconciledTreasuryAction,
  type SimDayPlan,
  type SimTemplate,
} from './simulatorEngine';

const db = () => prisma as any;

const fmt = (n: number) => `৳${Math.round(n).toLocaleString('en-IN')}`;
const newRunId = () => `sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export type DailyStreamEventType = 'CHECKOUT' | 'EXPENSE_ITEM' | 'DEBT_PAYMENT' | 'CASH_TRANSACTION';
export interface DailyStreamEvent {
  type: DailyStreamEventType;
  id: string;
  amount: number;
  direction: 'IN' | 'OUT';
  description: string;
  occurredAt: string;
}
export interface DailyStreamDay {
  day: number;
  date: string;
  phase: string;
  events: DailyStreamEvent[];
  runningBalance: number;
  revenue: number;
  expense: number;
}

/** 30-day (default) midday timestamp for a given ISO day, spaced so same-day rows keep a stable order. */
function dayTimestamp(date: string, offsetMinutes = 0): Date {
  return new Date(new Date(`${date}T12:00:00.000Z`).getTime() + offsetMinutes * 60000);
}

async function ensureSimulatorBuyer(tenantId: string) {
  const number = `SIM-${tenantId.slice(0, 10)}`;
  let buyer = await db().buyer.findUnique({ where: { number } });
  if (!buyer) {
    const user = await db().user.upsert({
      where: { number },
      create: { number, status: 'ACTIVE', role: ['BUYER'], password: null, OTP: 0, name: 'Simulator Demo Customer' },
      update: {},
    });
    buyer = await db()
      .buyer.create({
        data: { name: 'Simulator Demo Customer', number, address: 'Finance Copilot simulator — not a real customer', userID: user.id },
      })
      .catch(() => db().buyer.findUnique({ where: { number } }));
  }
  return buyer;
}

async function ensureShopBuyerLink(tenantId: string, shopId: string, buyer: any) {
  const existing = await db().shopBuyer.findFirst({ where: { shopID: shopId, buyerID: buyer.userID } }).catch(() => null);
  if (existing) return;
  await db()
    .shopBuyer.create({
      data: { shopID: shopId, tenantID: tenantId, name: buyer.name, number: buyer.number, address: buyer.address, buyerID: buyer.userID },
    })
    .catch(() => undefined);
}

async function ensureExpenseBucket(client: any, tenantId: string, shopId: string, date: string, cache: Map<string, string>) {
  const d = new Date(`${date}T00:00:00.000Z`);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const key = `${year}-${month}`;
  const cached = cache.get(key);
  if (cached) return cached;
  let bucket = await client.expense.findFirst({ where: { shopID: shopId, tenantID: tenantId, year, month } });
  if (!bucket) bucket = await client.expense.create({ data: { shopID: shopId, tenantID: tenantId, year, month, totalAmount: 0 } });
  cache.set(key, bucket.id);
  return bucket.id as string;
}

const CASH_CATEGORY_FOR_EXPENSE: Record<string, string> = {
  PRODUCT: 'PRODUCT_PURCHASE',
  EMPLOYEE_SALARY: 'SALARY',
  GENERAL: 'OPERATING_EXPENSE',
};

export const simulatorService = {
  /**
   * Single fast "backend transaction" that plays out 30 simulated business
   * days into the REAL tables (Checkout, ExpenseItem, Debt/DebtPayments,
   * CashTransaction), then re-runs the real deterministic pipeline
   * (cashEngine projection, 9 alert rules, guard, counterfactual verifier,
   * agent scorecards) on top of it. Returns a day-by-day event list the
   * frontend drip-feeds at a user-adjustable per-transaction delay, plus the
   * final state every finance page needs to morph into (no extra round-trips).
   *
   * `template` picks the transaction density: 'LESS' (default — present pace,
   * one sale + occasional expense/day) or 'MORE' (~3x more, smaller rows/day).
   * Either way every row is a real, tagged (isSimulated/simulationRunID) write
   * into the owner's own shop — the template only changes how many rows.
   */
  async fastForward(tenantId: string, shopId: string, template?: SimTemplate) {
    const shop = await assertShop(tenantId, shopId);
    await ensureDefaultPolicies(db());
    await ensureCatalog(db());
    const accounts = await ensureAccounts(tenantId, shopId);
    const primary = accounts.find((a: any) => a.isPrimary) ?? accounts[0];

    const recentTxns = await loadCashTransactions(tenantId, shopId, 28);
    const recentHistory = dailyNetSeries(recentTxns as any, 28, new Date());
    const activeDays = recentHistory.filter((h) => h.inflow + h.outflow > 0);
    const baselineDailyRevenue = activeDays.length ? sumMoney(recentHistory.map((h) => h.inflow)) / recentHistory.length : 0;
    const baselineDailyOutflow = activeDays.length ? sumMoney(recentHistory.map((h) => h.outflow)) / recentHistory.length : 0;

    const simulationRunID = newRunId();
    const seed = seedFromString(`${shopId}:${simulationRunID}`);
    const plan = buildSimulationPlan({ seed, asOf: new Date(), baselineDailyRevenue, baselineDailyOutflow, template });

    const buyer = await ensureSimulatorBuyer(tenantId);
    await ensureShopBuyerLink(tenantId, shopId, buyer);

    const expenseBucketCache = new Map<string, string>();
    const streamDays: DailyStreamDay[] = [];
    let smallDebtId: string | null = null;
    let bigDebtId: string | null = null;
    let runningBalance = sumMoney(accounts.map((a: any) => a.currentBalance));

    await db().$transaction(async (tx: any) => {
      for (const day of plan.days as SimDayPlan[]) {
        const events: DailyStreamEvent[] = [];
        let revenue = 0;
        let expenseTotal = 0;
        // Every row within a day gets its own minute offset, in creation
        // order (sales, then expenses, then debt issue/collect) — this keeps
        // a stable, readable timestamp order for a day with several small
        // transactions instead of everything landing at the same instant.
        let minute = 1;

        for (const sale of day.sales) {
          const checkoutAt = dayTimestamp(day.date, minute++);
          const checkout = await tx.checkout.create({
            data: {
              shopID: shopId, tenantID: tenantId, buyerID: null,
              totalPrice: sale.amount, totalQuantity: sale.quantity, status: 'PAID',
              isSimulated: true, simulationRunID, createdAt: checkoutAt,
              items: { create: [{ tenantID: tenantId, productName: 'Simulated walk-in sale', unitPrice: sale.unitPrice, discountedPrice: sale.unitPrice, quantity: sale.quantity, createdAt: checkoutAt }] },
            },
          });
          const cashTxn = await tx.cashTransaction.create({
            data: {
              tenantID: tenantId, shopID: shopId, accountID: primary.id, direction: 'IN', amount: sale.amount,
              category: 'SALES_COLLECTION', occurredAt: dayTimestamp(day.date, minute++), description: 'Simulated daily sales',
              source: 'SIMULATOR', sourceRefID: checkout.id, status: 'CLEARED', isSimulated: true, simulationRunID,
            },
          });
          revenue += sale.amount;
          events.push({ type: 'CHECKOUT', id: checkout.id, amount: sale.amount, direction: 'IN', description: `Sale receipt · ${sale.quantity} item(s)`, occurredAt: cashTxn.occurredAt.toISOString() });
          events.push({ type: 'CASH_TRANSACTION', id: cashTxn.id, amount: sale.amount, direction: 'IN', description: 'Sales collection cleared', occurredAt: cashTxn.occurredAt.toISOString() });
        }

        for (const expense of day.expenses) {
          const expenseBucketID = await ensureExpenseBucket(tx, tenantId, shopId, day.date, expenseBucketCache);
          const itemAt = dayTimestamp(day.date, minute++);
          const item = await tx.expenseItem.create({
            data: {
              expenseID: expenseBucketID, tenantID: tenantId, amount: expense.amount, name: expense.label,
              expenseType: expense.expenseType, isSimulated: true, simulationRunID, createdAt: itemAt,
            },
          });
          await tx.expense.update({ where: { id: expenseBucketID }, data: { totalAmount: { increment: expense.amount } } });
          const cashTxn = await tx.cashTransaction.create({
            data: {
              tenantID: tenantId, shopID: shopId, accountID: primary.id, direction: 'OUT', amount: expense.amount,
              category: CASH_CATEGORY_FOR_EXPENSE[expense.expenseType] ?? 'OPERATING_EXPENSE', occurredAt: dayTimestamp(day.date, minute++),
              description: expense.label, source: 'SIMULATOR', sourceRefID: item.id, status: 'CLEARED', isSimulated: true, simulationRunID,
            },
          });
          expenseTotal += expense.amount;
          events.push({ type: 'EXPENSE_ITEM', id: item.id, amount: expense.amount, direction: 'OUT', description: expense.label, occurredAt: cashTxn.occurredAt.toISOString() });
          events.push({ type: 'CASH_TRANSACTION', id: cashTxn.id, amount: expense.amount, direction: 'OUT', description: `${expense.label} cleared`, occurredAt: cashTxn.occurredAt.toISOString() });
        }

        if (day.debtIssued) {
          const checkoutAt = dayTimestamp(day.date, minute++);
          const checkout = await tx.checkout.create({
            data: {
              shopID: shopId, tenantID: tenantId, buyerID: buyer.userID,
              totalPrice: day.debtIssued.amount, totalQuantity: 1, status: 'UNPAID',
              isSimulated: true, simulationRunID, createdAt: checkoutAt,
              items: { create: [{ tenantID: tenantId, productName: day.debtIssued.label, unitPrice: day.debtIssued.amount, discountedPrice: day.debtIssued.amount, quantity: 1, createdAt: checkoutAt }] },
            },
          });
          const debt = await tx.debt.create({
            data: { checkoutID: checkout.id, buyerID: buyer.userID, shopID: shopId, tenantID: tenantId, status: 'UNPAID', paidAmount: 0, isSimulated: true, simulationRunID },
          });
          if (day.day === plan.smallDebtDay) smallDebtId = debt.id;
          if (day.day === plan.bigDebtDay) bigDebtId = debt.id;
          events.push({ type: 'CHECKOUT', id: checkout.id, amount: day.debtIssued.amount, direction: 'IN', description: `${day.debtIssued.label} (on credit)`, occurredAt: checkout.createdAt.toISOString() });
        }

        if (day.debtCollectsEarlierDebt && smallDebtId) {
          const debt = await tx.debt.findUnique({ where: { id: smallDebtId } });
          if (debt && debt.status !== 'PAID') {
            const amount = roundCurrency(plan.smallDebtAmount);
            const payment = await tx.debtPayments.create({ data: { debtId: smallDebtId, amount, isSimulated: true, simulationRunID, createdAt: dayTimestamp(day.date, minute++) } });
            await tx.debt.update({ where: { id: smallDebtId }, data: { paidAmount: amount, status: 'PAID' } });
            const cashTxn = await tx.cashTransaction.create({
              data: {
                tenantID: tenantId, shopID: shopId, accountID: primary.id, direction: 'IN', amount,
                category: 'INVOICE_PAYMENT', occurredAt: dayTimestamp(day.date, minute++), description: 'Customer settled credit sale',
                source: 'SIMULATOR', sourceRefID: payment.id, status: 'CLEARED', isSimulated: true, simulationRunID,
              },
            });
            revenue += amount;
            events.push({ type: 'DEBT_PAYMENT', id: payment.id, amount, direction: 'IN', description: 'Debt payment received', occurredAt: cashTxn.occurredAt.toISOString() });
            events.push({ type: 'CASH_TRANSACTION', id: cashTxn.id, amount, direction: 'IN', description: 'Collection cleared', occurredAt: cashTxn.occurredAt.toISOString() });
          }
        }

        runningBalance = roundCurrency(runningBalance + revenue - expenseTotal);
        streamDays.push({ day: day.day, date: day.date, phase: day.phase, events, runningBalance, revenue: roundCurrency(revenue), expense: roundCurrency(expenseTotal) });
      }
    }, { timeout: 30000, maxWait: 10000 });

    await refreshBalances(tenantId, shopId);

    // --- Re-run the REAL treasury pipeline (9 alert rules + guard), amplifying
    // the last day's outflow if a real shop's own history diluted the shortfall. ---
    // evaluateAlerts() dedupes against existing OPEN alerts by triggerRule, so a
    // real pre-existing alert can be reused instead of a new row being created.
    // Snapshot ids first so only genuinely-new alerts get tagged isSimulated —
    // reset() must never delete a real alert that happened to already be open.
    const preExistingAlertIDs = new Set(
      (await db().cashAlert.findMany({ where: { tenantID: tenantId, shopID: shopId, status: 'OPEN' }, select: { id: true } }).catch(() => [])).map((a: any) => a.id),
    );
    let treasury = await cashflowService.runTreasury(tenantId, shopId);
    let attempt = 0;
    while (!treasury.alerts.some((a: any) => a.severity === 'CRITICAL') && attempt < 3) {
      attempt++;
      const topUp = amplifierTopUp(attempt, baselineDailyOutflow, seed);
      const lastDay = plan.days[plan.days.length - 1];
      const bucketID = await ensureExpenseBucket(db(), tenantId, shopId, lastDay.date, expenseBucketCache);
      const item = await db().expenseItem.create({
        data: { expenseID: bucketID, tenantID: tenantId, amount: topUp, name: 'Supplier payment pulled forward', expenseType: 'GENERAL', isSimulated: true, simulationRunID, createdAt: dayTimestamp(lastDay.date, 20 + attempt) },
      });
      await db().expense.update({ where: { id: bucketID }, data: { totalAmount: { increment: topUp } } });
      const cashTxn = await db().cashTransaction.create({
        data: { tenantID: tenantId, shopID: shopId, accountID: primary.id, direction: 'OUT', amount: topUp, category: 'OPERATING_EXPENSE', occurredAt: dayTimestamp(lastDay.date, 20 + attempt), description: 'Supplier payment pulled forward', source: 'SIMULATOR', sourceRefID: item.id, status: 'CLEARED', isSimulated: true, simulationRunID },
      });
      const lastStream = streamDays[streamDays.length - 1];
      lastStream.events.push({ type: 'EXPENSE_ITEM', id: item.id, amount: topUp, direction: 'OUT', description: 'Supplier payment pulled forward', occurredAt: cashTxn.occurredAt.toISOString() });
      lastStream.events.push({ type: 'CASH_TRANSACTION', id: cashTxn.id, amount: topUp, direction: 'OUT', description: 'Supplier payment cleared', occurredAt: cashTxn.occurredAt.toISOString() });
      lastStream.expense = roundCurrency(lastStream.expense + topUp);
      lastStream.runningBalance = roundCurrency(lastStream.runningBalance - topUp);
      await refreshBalances(tenantId, shopId);
      treasury = await cashflowService.runTreasury(tenantId, shopId);
    }
    const newAlertIDs = treasury.alerts.map((a: any) => a.id).filter((id: string) => !preExistingAlertIDs.has(id));
    if (newAlertIDs.length) {
      await db().cashAlert.updateMany({ where: { id: { in: newAlertIDs } }, data: { isSimulated: true, simulationRunID } }).catch(() => undefined);
    }
    const criticalAlert = treasury.alerts.find((a: any) => a.severity === 'CRITICAL') ?? treasury.alerts[0] ?? null;

    // --- Guaranteed, guard-verified treasury reconciliation (Layer 3: 📈 toast) ---
    const policy = await db().aiAgentPolicy.findFirst({ where: { agentType: 'TREASURER_AGENT', isActive: true } }).catch(() => null);
    let treasuryAction: any = null;
    if (bigDebtId) {
      const debtRow = await db().debt.findUnique({ where: { id: bigDebtId } });
      const outstanding = roundCurrency(Math.max(0, plan.bigDebtAmount - (debtRow?.paidAmount ?? 0)));
      const balances = treasury.projection.dailyBuckets.map((b: any) => b.closingBalance);
      const recon = buildReconciledTreasuryAction({ debtAmount: outstanding, dailyClosingBalances: balances, effectDayIndex: 2, maxExposure: policy?.maxExposure ?? null, seed });
      treasuryAction = await db().treasuryAction.create({
        data: {
          tenantID: tenantId, shopID: shopId, agentPolicyID: policy?.id ?? 'policy-treasurer-agent', actionType: 'COLLECT_DEBT',
          title: `Collect overdue balance — ${plan.bigDebtLabel}`, rationale: recon.verdict.passed ? `Collecting ৳${outstanding} clears the projected shortfall within the buffer floor.` : recon.verdict.reasons.join('; '),
          amount: outstanding, targetRefID: bigDebtId, expectedDaysToEffect: 3, projectedImpact: recon.projectedImpact,
          realizedImpact: recon.verdict.passed ? recon.realizedImpact : null, status: recon.verdict.passed ? 'RECONCILED' : 'REJECTED',
          requiresOwnerApproval: false, executedAt: new Date(), reconciledAt: recon.verdict.passed ? new Date() : null,
          isSimulated: true, simulationRunID,
        },
      });
      await db().aiDecision.create({
        data: {
          tenantID: tenantId, shopID: shopId, agentType: 'TREASURER_AGENT', decisionType: 'TREASURY_ACTION',
          action: recon.verdict.passed ? `Collected overdue receivable from ${plan.bigDebtLabel}` : 'Collection attempt blocked by guard',
          rationale: treasuryAction.rationale, confidence: 0.8, model: 'deterministic-fallback', promptVersion: 'simulator-v1',
          inputHash: hashInput({ simulationRunID, bigDebtId }), inputSnapshot: { outstanding, effectDayIndex: 2 },
          output: JSON.parse(JSON.stringify({ verdict: recon.verdict, realizedImpact: recon.realizedImpact })),
          projectedImpact: recon.projectedImpact, realizedImpact: recon.verdict.passed ? recon.realizedImpact : null,
          guardResult: recon.verdict.passed ? 'PASSED' : 'REJECTED_BY_GUARD', guardReason: recon.verdict.reasons.join('; ') || null,
          status: recon.verdict.passed ? 'RECONCILED' : 'REJECTED', isSimulated: true, simulationRunID,
        },
      }).catch(() => undefined);
      if (recon.verdict.passed) {
        const payment = await db().debtPayments.create({ data: { debtId: bigDebtId, amount: recon.realizedImpact, isSimulated: true, simulationRunID } });
        await db().debt.update({ where: { id: bigDebtId }, data: { paidAmount: recon.realizedImpact, status: 'PAID' } });
        const cashTxn = await db().cashTransaction.create({
          data: { tenantID: tenantId, shopID: shopId, accountID: primary.id, direction: 'IN', amount: recon.realizedImpact, category: 'INVOICE_PAYMENT', occurredAt: new Date(), description: `Collected: ${plan.bigDebtLabel}`, source: 'SIMULATOR', sourceRefID: payment.id, status: 'CLEARED', isSimulated: true, simulationRunID },
        });
        const lastStream = streamDays[streamDays.length - 1];
        lastStream.events.push({ type: 'DEBT_PAYMENT', id: payment.id, amount: recon.realizedImpact, direction: 'IN', description: `Treasurer collected: ${plan.bigDebtLabel}`, occurredAt: cashTxn.occurredAt.toISOString() });
        lastStream.events.push({ type: 'CASH_TRANSACTION', id: cashTxn.id, amount: recon.realizedImpact, direction: 'IN', description: 'Treasury collection cleared', occurredAt: cashTxn.occurredAt.toISOString() });
        await refreshBalances(tenantId, shopId);
      }
    }

    // --- Guaranteed guard-blocked lender offer (Layer 3: 🛡️ toast) ---
    const product =
      (await db().financeProduct.findFirst({ where: { name: 'Merchant Cash Advance' } })) ??
      (await db().financeProduct.findFirst({ orderBy: { interestRateMax: 'desc' } }));
    let guardDecision: any = null;
    if (product) {
      const offerScenario = buildGuardBlockedOfferScenario(product, baselineDailyRevenue, seed);
      guardDecision = await db().aiDecision.create({
        data: {
          tenantID: tenantId, shopID: shopId, agentType: 'LENDER_AGENT', decisionType: 'ISSUE_OFFER',
          action: `Priced ${product.name} at ${offerScenario.offeredRate}%`,
          rationale: `Effective APR ${offerScenario.effectiveAprPct}% on ${fmt(offerScenario.offeredAmount)} vs owner ceiling ${offerScenario.ownerMaxRate}% and affordability cap ${fmt(offerScenario.maxAffordableAmount)}.`,
          confidence: 0.55, model: 'deterministic-fallback', promptVersion: 'simulator-v1',
          inputHash: hashInput({ simulationRunID, productID: product.id }),
          inputSnapshot: { productID: product.id, productName: product.name },
          output: JSON.parse(JSON.stringify(offerScenario)),
          projectedImpact: 0, realizedImpact: null,
          guardResult: offerScenario.verdict.passed ? 'PASSED' : 'REJECTED_BY_GUARD',
          guardReason: offerScenario.verdict.reasons.join('; ') || null,
          status: offerScenario.verdict.passed ? 'PROPOSED' : 'REJECTED',
          isSimulated: true, simulationRunID,
        },
      });
      (plan as any).guardOfferScenario = offerScenario;
    }

    // --- Guaranteed VERIFIED insight (Layer 2 analysis card) ---
    const anomaly = buildAnomalyInsight(plan);
    const insight = await db().insight.create({
      data: {
        tenantID: tenantId, shopID: shopId, insightType: 'ANOMALY', severity: 'WARNING', title: anomaly.title, summary: anomaly.summary,
        metricSnapshot: { anomalyAmount: plan.anomalyAmount, anomalyDay: plan.anomalyDay, anomalyLabel: plan.anomalyLabel },
        hypothesis: anomaly.hypothesis, candidates: [anomaly.candidate], verificationStatus: anomaly.verification.status,
        verifiedMetrics: anomaly.verification.verifiedMetrics, aiConfidence: 0.82, model: 'deterministic-fallback',
        promptVersion: 'simulator-v1', status: 'NEW', isSimulated: true, simulationRunID,
      },
    });

    const performance = await agentsService.performance(tenantId, shopId);
    const finalProjection = await cashflowService.getProjection(tenantId, shopId, 90, false);

    const alpha = treasuryAction?.realizedImpact != null ? roundCurrency(treasuryAction.realizedImpact - treasuryAction.projectedImpact) : 0;
    const toasts = [
      criticalAlert && {
        id: 'critical', kind: 'critical', uiCueDay: Math.max(18, plan.horizonDays - 6),
        title: '🚨 CRITICAL', message: `Cash shortfall of ${fmt(criticalAlert.projectedShortfall ?? treasury.projection.shortfallAmount ?? 0)} predicted on ${treasury.projection.shortfallDate ?? 'the near horizon'}. TREASURER_AGENT has proposed ${treasuryAction ? 1 : 0} action${treasuryAction ? '' : 's'}.`,
        actionLabel: 'View alert', actionHref: '/finance/cashflow', refID: criticalAlert.id,
      },
      guardDecision && {
        id: 'guard', kind: 'guard', uiCueDay: Math.max(22, plan.horizonDays - 3),
        title: '🛡️ GUARD BLOCKED', message: (plan as any).guardOfferScenario?.toastMessage ?? 'Offer rejected by the affordability guard.',
        actionLabel: 'View decision', actionHref: '/finance/agent', refID: guardDecision.id,
      },
      treasuryAction && treasuryAction.status === 'RECONCILED' && {
        id: 'reconciled', kind: 'reconciled', uiCueDay: plan.horizonDays,
        title: '📈 RECONCILED', message: `Treasury action yielded +${fmt(treasuryAction.realizedImpact)} realized impact (+${fmt(alpha)} alpha vs. benchmark).`,
        actionLabel: 'View scorecard', actionHref: '/finance/agent', refID: treasuryAction.id,
      },
    ].filter(Boolean);

    return {
      simulationRunID,
      shopName: shop.shopName,
      seed,
      dailyEvents: streamDays,
      insight: { ...insight, candidates: [anomaly.candidate], verifiedMetrics: anomaly.verification.verifiedMetrics },
      toasts,
      finalState: {
        projection: treasury.projection,
        projectionAfterAction: finalProjection,
        alerts: treasury.alerts,
        treasuryActions: treasuryAction ? [treasuryAction] : [],
        guardDecision,
        performance: performance.performance,
      },
    };
  },

  async inspect(tenantId: string, shopId: string, type: string, id: string) {
    await assertShop(tenantId, shopId);
    if (type === 'CHECKOUT') {
      const row = await db().checkout.findFirst({ where: { id, tenantID: tenantId, shopID: shopId }, include: { items: true, Debt: true } });
      if (!row) throw Object.assign(new Error('Checkout not found'), { statusCode: 404 });
      return { type, row };
    }
    if (type === 'EXPENSE_ITEM') {
      const row = await db().expenseItem.findFirst({ where: { id, tenantID: tenantId, expense: { shopID: shopId, tenantID: tenantId } }, include: { expense: true } });
      if (!row) throw Object.assign(new Error('Expense item not found'), { statusCode: 404 });
      return { type, row };
    }
    if (type === 'DEBT_PAYMENT') {
      const row = await db().debtPayments.findFirst({ where: { id, debt: { shopID: shopId, tenantID: tenantId } }, include: { debt: true } });
      if (!row) throw Object.assign(new Error('Debt payment not found'), { statusCode: 404 });
      return { type, row };
    }
    if (type === 'CASH_TRANSACTION') {
      const row = await db().cashTransaction.findFirst({ where: { id, tenantID: tenantId, shopID: shopId } });
      if (!row) throw Object.assign(new Error('Cash transaction not found'), { statusCode: 404 });
      return { type, row };
    }
    throw Object.assign(new Error('Unknown inspect type'), { statusCode: 400 });
  },

  /** Wipes every row this simulator wrote for the shop, in FK-safe order, and recomputes balances. */
  async reset(tenantId: string, shopId: string) {
    await assertShop(tenantId, shopId);
    // Strict FK-safe order: DebtPayments → Debt → Checkout (cascades CheckoutItem),
    // then the independent tables. Promise.all would race Debt against the
    // Checkout it points to, so this stays sequential on purpose.
    const debtPayments = await db().debtPayments.deleteMany({ where: { isSimulated: true, debt: { shopID: shopId, tenantID: tenantId } } });
    const debts = await db().debt.deleteMany({ where: { shopID: shopId, tenantID: tenantId, isSimulated: true } });
    const checkouts = await db().checkout.deleteMany({ where: { shopID: shopId, tenantID: tenantId, isSimulated: true } });
    const expenseItems = await db().expenseItem.deleteMany({ where: { tenantID: tenantId, isSimulated: true, expense: { shopID: shopId, tenantID: tenantId } } });
    const cashTxns = await db().cashTransaction.deleteMany({ where: { tenantID: tenantId, shopID: shopId, isSimulated: true } });
    const alerts = await db().cashAlert.deleteMany({ where: { tenantID: tenantId, shopID: shopId, isSimulated: true } });
    const actions = await db().treasuryAction.deleteMany({ where: { tenantID: tenantId, shopID: shopId, isSimulated: true } });
    const insights = await db().insight.deleteMany({ where: { tenantID: tenantId, shopID: shopId, isSimulated: true } });
    const decisions = await db().aiDecision.deleteMany({ where: { tenantID: tenantId, shopID: shopId, isSimulated: true } });
    await db().financingOffer.deleteMany({ where: { tenantID: tenantId, shopID: shopId, isSimulated: true } }).catch(() => undefined);
    await refreshBalances(tenantId, shopId);
    return {
      cleared: {
        debtPayments: debtPayments.count, debts: debts.count, checkouts: checkouts.count, expenseItems: expenseItems.count,
        cashTransactions: cashTxns.count, alerts: alerts.count, treasuryActions: actions.count, insights: insights.count, decisions: decisions.count,
      },
    };
  },
};

