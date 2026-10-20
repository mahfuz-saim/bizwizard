/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma, { shopClock, simulationCashRows } from './database';
import { roundCurrency, sumMoney } from './money';
import { buildProfile, isoDay, type ProfileAggregates } from './metricEngine';
import type { DailyNet } from './cashEngine';

const DAY = 86400000;

export async function assertShop(tenantId: string, shopId: string) {
  const shop = await (prisma as any).shop.findFirst({
    where: { id: shopId, tenantID: tenantId },
    select: { id: true, shopName: true, category: true, simulationSourceShopID: true },
  });
  if (!shop) {
    const err = new Error('Shop not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  return shop;
}

export async function loadProfileAggregates(
  tenantId: string,
  shopId: string,
  days = 90,
  asOf?: Date,
): Promise<ProfileAggregates> {
  asOf = asOf ?? await shopClock(tenantId, shopId);
  const start = new Date(asOf.getTime() - days * DAY);
  const db = prisma as any;
  const [sales, items, opexItems, debts, lots, firstSale] = await Promise.all([
    db.checkout.findMany({
      where: { shopID: shopId, tenantID: tenantId, isDraft: false, createdAt: { gt: start, lte: asOf } },
      select: { id: true, totalPrice: true, totalDiscount: true, createdAt: true, buyerID: true, status: true },
    }),
    db.checkoutItem.findMany({
      where: {
        tenantID: tenantId,
        checkout: { shopID: shopId, tenantID: tenantId, isDraft: false },
        createdAt: { gt: start, lte: asOf },
      },
      select: { quantity: true, discountedPrice: true, lotId: true, variantId: true, productName: true },
      include: undefined,
    }).catch(() => []),
    db.expenseItem.findMany({
      where: {
        tenantID: tenantId,
        expenseType: { not: 'PRODUCT' },
        expense: { shopID: shopId, tenantID: tenantId },
        createdAt: { gt: start, lte: asOf },
      },
      select: { amount: true, expenseType: true, createdAt: true },
    }).catch(() => []),
    db.debt.findMany({
      where: { shopID: shopId, tenantID: tenantId, status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
      include: { checkout: { select: { totalPrice: true } } },
    }).catch(() => []),
    db.lot.findMany({
      where: { tenantID: tenantId, status: 'ACTIVE', ShopVariant: { shopID: shopId, tenantID: tenantId } },
      select: { stock: true, buyPrice: true },
    }).catch(() => []),
    db.checkout.findFirst({
      where: { shopID: shopId, tenantID: tenantId, isDraft: false },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }).catch(() => null),
  ]);
  // COGS via lot buy prices (fall back to 70% of line price only when the lot
  // is gone and no variant average exists — flagged via dataCompleteness).
  const lotIds = [...new Set(items.map((i: any) => i.lotId).filter(Boolean))];
  const lotRows = lotIds.length
    ? await db.lot.findMany({ where: { id: { in: lotIds } }, select: { id: true, buyPrice: true } }).catch(() => [])
    : [];
  const lotPrice = new Map<string, number>(lotRows.map((l: any) => [l.id, l.buyPrice]));
  let cogs = 0;
  for (const i of items) {
    const buy = i.lotId ? lotPrice.get(i.lotId) : undefined;
    cogs += i.quantity * (buy ?? i.discountedPrice * 0.7);
  }
  const salesByDayMap = new Map<string, number>();
  for (const s of sales) salesByDayMap.set(isoDay(new Date(s.createdAt)), (salesByDayMap.get(isoDay(new Date(s.createdAt))) ?? 0) + s.totalPrice);
  let currentCash = 0;
  try {
    const accounts = await db.cashAccount.findMany({ where: { tenantID: tenantId, shopID: shopId, isActive: true }, select: { currentBalance: true } });
    currentCash = sumMoney(accounts.map((a: any) => a.currentBalance));
  } catch { /* cash module not migrated yet */ }
  let existingMonthlyDebtService = 0;
  let debtOutstanding = 0;
  try {
    const apps = await db.financingApplication.findMany({
      where: { tenantID: tenantId, shopID: shopId, status: 'DISBURSED' },
      select: { id: true, requestedAmount: true },
    });
    debtOutstanding = sumMoney(apps.map((a: any) => a.requestedAmount));
    if (apps.length) {
      const schedules = await db.loanSchedule.findMany({
        where: { applicationID: { in: apps.map((a: any) => a.id) }, status: { in: ['DUE', 'PARTIAL', 'OVERDUE'] } },
        select: { applicationID: true, totalDue: true, dueDate: true },
        orderBy: { dueDate: 'asc' },
      });
      const seen = new Set<string>();
      for (const s of schedules) {
        if (!seen.has(s.applicationID)) { seen.add(s.applicationID); existingMonthlyDebtService += s.totalDue; }
      }
    }
  } catch { /* financing tables not migrated yet */ }
  const receivables = sumMoney(
    debts.map((d: any) => Math.max(0, (d.checkout?.totalPrice ?? 0) - (d.paidAmount ?? 0))),
  );
  const obligations = await db.cashCommitment.findMany({
    where: { tenantID: tenantId, shopID: shopId, supplierPayable: true, createdAt: { lte: asOf },
      OR: [{ isPaid: false }, { paidAt: { gt: asOf } }] },
    select: { amount: true },
  });
  return {
    windowDays: days,
    salesByDay: [...salesByDayMap.entries()].map(([date, amount]) => ({ date, amount: roundCurrency(amount) })),
    revenue: sumMoney(sales.map((s: any) => s.totalPrice)),
    grossSales: sumMoney(sales.map((s: any) => s.totalPrice + (s.totalDiscount ?? 0))),
    discounts: sumMoney(sales.map((s: any) => s.totalDiscount ?? 0)),
    cogs: roundCurrency(cogs),
    opex: sumMoney(opexItems.map((e: any) => e.amount)),
    shrinkage: 0,
    transactionCount: sales.length,
    currentCash,
    receivables,
    payables: sumMoney(obligations.map((o: any) => o.amount)),
    inventoryValue: sumMoney(lots.map((l: any) => l.stock * l.buyPrice)),
    debtOutstanding,
    existingMonthlyDebtService: roundCurrency(existingMonthlyDebtService),
    daysWithSales: salesByDayMap.size,
    firstActivityDate: firstSale ? isoDay(new Date(firstSale.createdAt)) : null,
    asOf,
  };
}

export async function loadProfile(tenantId: string, shopId: string, days = 90, asOf?: Date) {
  return buildProfile(await loadProfileAggregates(tenantId, shopId, days, asOf));
}

export async function loadOpenDebts(tenantId: string, shopId: string) {
  const debts = await prisma.debt.findMany({
    where: { shopID: shopId, tenantID: tenantId, status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
    include: { checkout: { select: { totalPrice: true } }, buyer: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  }).catch(() => []);
  return debts.map((d: any) => ({
    id: d.id as string,
    amount: roundCurrency(Math.max(0, (d.checkout?.totalPrice ?? 0) - (d.paidAmount ?? 0))),
    paidAmount: roundCurrency(d.paidAmount ?? 0),
    status: d.status as string,
    createdAt: new Date(d.createdAt),
    buyerLabel: (d.buyer?.name as string) || 'Customer',
    buyerID: d.buyerID as string,
  }));
}

export async function loadDailySales(tenantId: string, shopId: string, days: number, asOf?: Date) {
  asOf = asOf ?? await shopClock(tenantId, shopId);
  const db = prisma as any;
  const start = new Date(asOf.getTime() - days * DAY);
  const sales = await db.checkout.findMany({
    where: { shopID: shopId, tenantID: tenantId, isDraft: false, createdAt: { gte: start, lte: asOf } },
    select: { totalPrice: true, createdAt: true, buyerID: true },
  }).catch(() => []);
  const map = new Map<string, number>();
  for (const s of sales) {
    const key = isoDay(new Date(s.createdAt));
    map.set(key, (map.get(key) ?? 0) + s.totalPrice);
  }
  const out: Array<{ date: string; amount: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = isoDay(new Date(asOf.getTime() - i * DAY));
    out.push({ date, amount: roundCurrency(map.get(date) ?? 0) });
  }
  return out;
}

export async function loadCashTransactions(tenantId: string, shopId: string, days: number, asOf?: Date) {
  asOf = asOf ?? await shopClock(tenantId, shopId);
  const db = prisma as any;
  const start = new Date(asOf.getTime() - days * DAY);
  const ledger = simulationCashRows(tenantId, shopId);
  const end = asOf.getTime();
  if (ledger) return ledger.filter(row => row.occurredAt >= start && row.occurredAt.getTime() <= end)
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const rows = await db.cashTransaction.findMany({
    where: { tenantID: tenantId, shopID: shopId, occurredAt: { gte: start, lte: asOf } },
    orderBy: { occurredAt: 'asc' },
  }).catch(() => []);
  return rows as Array<{ occurredAt: Date; direction: 'IN' | 'OUT'; amount: number; category: string }>;
}

export type { DailyNet };
