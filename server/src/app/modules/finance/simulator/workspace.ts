/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../../../shared/prisma';
import { simulationContext } from '../shared/database';
import { cashflowService } from '../cashflow/cashflow.service';

export const simulationError = (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode });

export async function workspaceFor(tenantID: string, shopID: string) {
  const shop = await prisma.shop.findFirst({ where: { id: shopID, tenantID } });
  if (!shop) throw simulationError('Shop not found', 404);
  return shop;
}

export async function lockedWorkspace<T>(tenantID: string, shopID: string, work: (tx: any, shop: any) => Promise<T>) {
  return prisma.$transaction(async tx => {
    const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(hashtext(${`simulator:${shopID}`})) AS locked`;
    if (!lock.locked) throw simulationError('This demo workspace is busy. Wait for the current operation to finish.');
    const shop = await tx.shop.findFirst({ where: { id: shopID, tenantID } });
    if (!shop) throw simulationError('Shop not found', 404);
    return work(tx, shop);
  }, { timeout: 120000, maxWait: 10000, isolationLevel: 'RepeatableRead' });
}

export async function requireDemo(tx: any, tenantID: string, shopID: string) {
  const shop = await tx.shop.findFirst({ where: { id: shopID, tenantID } });
  if (!shop?.simulationSourceShopID || !shop.simulationBaselineAt || !shop.simulationAsOf)
    throw simulationError('Simulation is allowed only in a dedicated demo workspace.', 403);
  return shop;
}

/**
 * How much history the demo workspace needs.
 *
 * Every finance read the simulator relies on looks back a bounded amount of
 * time: the sales/expense profile aggregates reach 90 days back
 * (loadProfileAggregates), the cash projection 180 days back
 * (loadCashTransactions). Copying the source shop's *whole* history into the
 * demo shop therefore copied tens of thousands of rows nobody reads, and the
 * first run (plus every reset) spent tens of seconds in "preparing" before a
 * single transaction could appear. The windows below cover every horizon the
 * simulator actually reads — so every number it sees stays identical — while
 * making the copy a fraction of the size.
 */
const SALES_WINDOW_DAYS = 90;
const CASH_WINDOW_DAYS = 180;
/** The windows are anchored on the source's last activity; the baseline clock
 *  sits at the end of that day, so a couple of extra days are kept to cover
 *  the day the clock rounds up to. */
const WINDOW_MARGIN_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The most recent moment the source shop was active — the anchor of the window. */
async function latestSourceActivity(tx: any, tenantID: string, shopID: string): Promise<number> {
  const [sale, expense, cash] = await Promise.all([
    tx.checkout.findFirst({ where: { tenantID, shopID, isSimulated: false }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    tx.expenseItem.findFirst({ where: { tenantID, isSimulated: false, expense: { shopID } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    tx.cashTransaction.findFirst({ where: { tenantID, shopID, isSimulated: false }, orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } }),
  ]);
  const times = [sale?.createdAt, expense?.createdAt, cash?.occurredAt]
    .filter(Boolean)
    .map((t: any) => new Date(t).getTime());
  return times.length ? Math.max(...times) : Date.now();
}

/**
 * Money that moved before the window, per cash account.
 *
 * The demo shop only receives the transactions inside the window, so the part
 * that falls outside has to be folded into the account's opening balance —
 * otherwise the demo would start with a different cash position than the
 * source shop it is supposed to mirror.
 */
async function netCashBeforeWindow(tx: any, tenantID: string, shopID: string, windowStart: Date): Promise<Map<string, number>> {
  const rows = await tx.cashTransaction.findMany({
    where: { tenantID, shopID, isSimulated: false, status: 'CLEARED', occurredAt: { lt: windowStart } },
    select: { accountID: true, direction: true, amount: true },
  });
  const net = new Map<string, number>();
  for (const row of rows) {
    const delta = row.direction === 'IN' ? Number(row.amount) : -Number(row.amount);
    net.set(row.accountID, (net.get(row.accountID) ?? 0) + delta);
  }
  return net;
}

export async function copyBaseline(tx: any, source: any, demoID: string) {
  const tenantID = source.tenantID;
  const ids = new Map<string, string>();
  const remap = (id: string | null) => id ? ids.get(id) ?? null : null;
  let latest = 0;
  const copy = async (model: string, where: any, patch: (row: any) => any) => {
    const rows = await tx[model].findMany({ where });
    for (const row of rows) ids.set(row.id, randomUUID());
    const data = rows.map((row: any) => {
      const time = row.occurredAt ?? row.createdAt;
      if (['checkout', 'expenseItem', 'cashTransaction'].includes(model) && time) latest = Math.max(latest, new Date(time).getTime());
      return { ...row, id: ids.get(row.id), ...patch(row) };
    });
    for (let i = 0; i < data.length; i += 1000) await tx[model].createMany({ data: data.slice(i, i + 1000) });
    return rows;
  };

  // --- current state: copied in full (catalogue, people, standing commitments).
  await copy('shopBuyer', { tenantID, shopID: source.id }, () => ({ shopID: demoID }));
  await copy('shopSupplier', { tenantID, shopId: source.id }, () => ({ shopId: demoID }));
  await copy('shopVariant', { tenantID, shopID: source.id }, () => ({ shopID: demoID }));
  await copy('lot', { tenantID, ShopVariant: { shopID: source.id } }, r => ({ shopVariantId: remap(r.shopVariantId), supplyId: remap(r.supplyId) }));
  await copy('expense', { tenantID, shopID: source.id }, () => ({ shopID: demoID, totalAmount: 0 }));
  await copy('cashCommitment', { tenantID, shopID: source.id }, r => ({ shopID: demoID, paymentExpenseID: remap(r.paymentExpenseID) }));
  await copy('aiAgentPolicy', { tenantID, shopID: source.id, isActive: true }, () => ({ shopID: demoID }));

  // --- history: only the window the finance code actually reads.
  const anchor = await latestSourceActivity(tx, tenantID, source.id);
  const salesStart = new Date(anchor - (SALES_WINDOW_DAYS + WINDOW_MARGIN_DAYS) * DAY_MS);
  const cashStart = new Date(anchor - (CASH_WINDOW_DAYS + WINDOW_MARGIN_DAYS) * DAY_MS);

  // Receivables still open are what the demo is about, so they are kept even
  // when the sale behind them is older than the window.
  const openDebts = await tx.debt.findMany({
    where: { tenantID, shopID: source.id, isSimulated: false, status: { not: 'PAID' } },
    select: { id: true, checkoutID: true },
  });
  const openCheckoutIDs = openDebts.map((d: any) => d.checkoutID).filter(Boolean);
  const recentCheckout = { tenantID, shopID: source.id, isSimulated: false, createdAt: { gte: salesStart } };
  const checkoutWhere = openCheckoutIDs.length ? { OR: [recentCheckout, { tenantID, id: { in: openCheckoutIDs } }] } : recentCheckout;

  await copy('checkout', checkoutWhere, () => ({ shopID: demoID, soldByOwnerId: null, soldByEmployeeId: null }));
  await copy('checkoutItem', { tenantID, checkout: checkoutWhere }, r => ({ checkoutID: remap(r.checkoutID), lotId: remap(r.lotId), variantId: remap(r.variantId) }));
  const recentDebt = { tenantID, shopID: source.id, isSimulated: false, checkout: { createdAt: { gte: salesStart } } };
  const debtWhere = openDebts.length ? { OR: [recentDebt, { id: { in: openDebts.map((d: any) => d.id) } }] } : recentDebt;
  const copiedDebts = await copy('debt', debtWhere, r => ({ shopID: demoID, checkoutID: remap(r.checkoutID) }));
  // DebtPayments has no tenantID; its tenant boundary is the parent debt.
  const debtIDs = copiedDebts.map((d: any) => d.id);
  const payments = debtIDs.length ? await tx.debtPayments.findMany({ where: { isSimulated: false, debt: { id: { in: debtIDs } } } }) : [];
  for (const row of payments) ids.set(row.id, randomUUID());
  if (payments.length) await tx.debtPayments.createMany({ data: payments.map((r: any) => ({ ...r, id: ids.get(r.id), debtId: remap(r.debtId) })) });
  await copy('expenseItem', { tenantID, isSimulated: false, expense: { shopID: source.id }, createdAt: { gte: salesStart } }, r => ({ expenseID: remap(r.expenseID), shopVariantId: remap(r.shopVariantId), lotId: remap(r.lotId), supplierId: remap(r.supplierId) }));
  const totals = await tx.expenseItem.groupBy({ by: ['expenseID'], where: { tenantID, expense: { shopID: demoID } }, _sum: { amount: true } });
  for (const total of totals) await tx.expense.update({ where: { id: total.expenseID }, data: { totalAmount: total._sum.amount ?? 0 } });
  const carried = await netCashBeforeWindow(tx, tenantID, source.id, cashStart);
  await copy('cashAccount', { tenantID, shopID: source.id }, r => ({
    shopID: demoID,
    openingBalance: (r.openingBalance ?? 0) + (carried.get(r.id) ?? 0),
    currentBalance: (r.currentBalance ?? 0) + (carried.get(r.id) ?? 0),
  }));
  await copy('cashTransaction', { tenantID, shopID: source.id, isSimulated: false, occurredAt: { gte: cashStart } }, r => ({ shopID: demoID, accountID: remap(r.accountID), sourceRefID: remap(r.sourceRefID) }));
  const baselineAt = new Date(latest || Date.now());
  baselineAt.setUTCHours(23, 59, 59, 999);
  await tx.shop.update({ where: { id: demoID }, data: { simulationBaselineAt: baselineAt, simulationAsOf: baselineAt, simulationRunID: null, simulationResult: Prisma.DbNull } });
  await simulationContext.run({ client: tx, asOf: baselineAt }, async () => {
    if (!await tx.cashTransaction.count({ where: { tenantID, shopID: demoID } })) await cashflowService.backfill(tenantID, demoID);
  });
  return baselineAt;
}

export async function prepareWorkspace(tenantID: string, sourceID: string) {
  return lockedWorkspace(tenantID, sourceID, async (tx, source) => {
    if (source.simulationSourceShopID) throw simulationError('Choose a source shop, not another demo workspace.');
    let demo = await tx.shop.findUnique({ where: { simulationSourceShopID: sourceID } });
    if (!demo) {
      demo = await tx.shop.create({ data: {
        shopName: `${source.shopName} — Simulation demo`, contact: source.contact, category: source.category,
        tenantID, ownerID: source.ownerID, simulationSourceShopID: sourceID,
      } });
      await copyBaseline(tx, source, demo.id);
      demo = await tx.shop.findUniqueOrThrow({ where: { id: demo.id } });
    }
    return demo;
  });
}

export async function restoreWorkspace(tx: any, tenantID: string, shopID: string) {
  const demo = await requireDemo(tx, tenantID, shopID);
  const source = await tx.shop.findFirstOrThrow({ where: { id: demo.simulationSourceShopID, tenantID } });
  const scope = { tenantID, shopID };
  const notices = { tenantID, shopId: shopID };
  await tx.notificationRead.deleteMany({ where: { notification: notices } });
  await tx.notification.deleteMany({ where: notices });
  await tx.loanSchedule.deleteMany({ where: scope });
  await tx.treasuryActionEvidence.deleteMany({ where: scope });
  await tx.aiAgentPolicy.deleteMany({ where: scope });
  for (const model of ['financingNegotiation', 'financingApplication', 'financingOffer', 'financingMatch', 'financingMarketState', 'businessFinancialProfile', 'financialMetricSnapshot', 'cashFlowProjection', 'financeEvaluation', 'agentPerformance', 'capitalDecision', 'scenario', 'forecast', 'cashAlert', 'treasuryAction', 'insight', 'aiDecision', 'cashTransaction', 'cashAccount', 'cashCommitment']) {
    await tx[model].deleteMany({ where: scope });
  }
  await tx.debtPayments.deleteMany({ where: { debt: scope } });
  await tx.debt.deleteMany({ where: scope });
  await tx.checkout.deleteMany({ where: scope });
  await tx.expenseItem.deleteMany({ where: { tenantID, expense: { shopID } } });
  await tx.expense.deleteMany({ where: scope });
  await tx.lot.deleteMany({ where: { tenantID, ShopVariant: { shopID } } });
  await tx.shopVariant.deleteMany({ where: scope });
  const buyers = await tx.shopBuyer.findMany({ where: scope, select: { id: true } });
  const buyerIds = buyers.map((r: any) => r.id);
  await tx.buyerSystemTag.deleteMany({ where: { tenantID, buyerId: { in: buyerIds } } });
  await tx.buyerCustomTag.deleteMany({ where: { tenantID, buyerId: { in: buyerIds } } });
  await tx.shopBuyer.deleteMany({ where: scope });
  await tx.shopSupplier.deleteMany({ where: { tenantID, shopId: shopID } });
  const simulationAsOf = await copyBaseline(tx, source, shopID);
  return { shopID, simulationAsOf };
}
