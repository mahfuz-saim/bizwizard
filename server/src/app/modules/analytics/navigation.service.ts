import { Prisma } from '@prisma/client';
import prisma from '../../../shared/prisma';
import ApiError from '../../../errors/ApiError';
import { assertShop } from '../finance/shared/shopData';

const round = (n: number) => Math.round(n * 100) / 100;
const validSales = (tenantId: string, shopId: string) => Prisma.sql`
    c."tenantID" = ${tenantId} AND c."shopID" = ${shopId}
    AND NOT c."isDraft" AND c.status IN ('PAID', 'UNPAID', 'PENDING')`;

export interface NavigationQuery {
    shopId: string;
    page: number;
    search: string;
    type: 'all' | 'sale' | 'buy';
    variantId?: string;
}

async function directories(tenantId: string, shopId: string, owner: boolean) {
    const [buyers, suppliers, employees, totals, purchases] = await Promise.all([
        prisma.shopBuyer.findMany({ where: { tenantID: tenantId, shopID: shopId, isDeleted: false }, orderBy: { id: 'asc' } }),
        prisma.shopSupplier.findMany({ where: { tenantID: tenantId, shopId, isDeleted: false }, include: { supplier: { select: { name: true, createdAt: true } } }, orderBy: { id: 'asc' } }),
        owner ? prisma.employee.findMany({ where: { tenantID: tenantId, shopID: shopId, isDeleted: false }, select: { id: true, name: true, number: true, createdAt: true } }) : Promise.resolve([]),
        prisma.$queryRaw<Array<{ buyerID: string; total: number; due: number }>>(Prisma.sql`
            SELECT c."buyerID", SUM(c."totalPrice") AS total,
              SUM(GREATEST(0, c."totalPrice" - CASE WHEN d.id IS NOT NULL THEN LEAST(c."totalPrice", COALESCE(d."paidAmount", 0)) WHEN c.status = 'PAID' THEN c."totalPrice" ELSE 0 END)) AS due
            FROM checkouts c LEFT JOIN debt d ON d."checkoutID" = c.id AND d."tenantID" = ${tenantId}
            WHERE ${validSales(tenantId, shopId)} GROUP BY c."buyerID"`),
        owner ? prisma.expenseItem.groupBy({ by: ['supplierId'], where: { tenantID: tenantId, expenseType: 'PRODUCT', expense: { tenantID: tenantId, shopID: shopId } }, _sum: { amount: true } }) : Promise.resolve([]),
    ]);
    const byBuyer = new Map(totals.map(t => [t.buyerID, t]));
    const bySupplier = new Map(purchases.map(p => [p.supplierId, p._sum.amount ?? 0]));
    return {
        customers: buyers.map(b => ({ id: b.buyerID, name: b.name, phone: b.number, address: b.address, createdAt: b.createdAt,
            totalPurchased: round(byBuyer.get(b.buyerID)?.total ?? 0), totalDue: round(byBuyer.get(b.buyerID)?.due ?? 0) })),
        suppliers: suppliers.map(s => ({ id: s.id, userID: s.supplierId, name: s.supplierName || s.supplier.name || s.company || 'Supplier',
            phone: s.number, address: s.company, createdAt: s.supplier.createdAt, totalPurchased: round(bySupplier.get(s.id) ?? 0),
            totalPaid: 0, totalDue: 0, paymentTracked: false })),
        employees: employees.map(e => ({ id: e.id, name: e.name, phone: e.number, joinedAt: e.createdAt, role: 'EMPLOYEE' })),
    };
}

async function transactions(tenantId: string, q: NavigationQuery, owner: boolean) {
    const entries = Prisma.sql`WITH entries AS (
        SELECT c.id, 'SALE' AS type, c."createdAt", c."totalPrice" AS total,
          GREATEST(0, c."totalPrice" - CASE WHEN d.id IS NOT NULL THEN LEAST(c."totalPrice", COALESCE(d."paidAmount", 0)) WHEN c.status = 'PAID' THEN c."totalPrice" ELSE 0 END) AS due,
          COALESCE(b.name, 'Walk-in Customer') AS name
        FROM checkouts c LEFT JOIN buyer b ON b."userID" = c."buyerID"
        LEFT JOIN debt d ON d."checkoutID" = c.id AND d."tenantID" = ${tenantId}
        WHERE ${validSales(tenantId, q.shopId)}
          ${q.variantId ? Prisma.sql`AND EXISTS (SELECT 1 FROM checkout_items ci LEFT JOIN lot l ON l.id = ci."lotId"
            WHERE ci."checkoutID" = c.id AND ci."tenantID" = ${tenantId} AND COALESCE(l."shopVariantId", ci."variantId") = ${q.variantId})` : Prisma.empty}
        UNION ALL
        SELECT e.id, 'BUY', e."createdAt", e.amount, 0, COALESCE(s."supplierName", 'Not recorded')
        FROM expense_item e JOIN expense x ON x.id = e."expenseID"
        LEFT JOIN shop_supplier s ON s.id = e."supplierId" AND s."tenantID" = ${tenantId}
        WHERE ${owner} AND e."tenantID" = ${tenantId} AND x."tenantID" = ${tenantId} AND x."shopID" = ${q.shopId} AND e."expenseType" = 'PRODUCT'
          ${q.variantId ? Prisma.sql`AND e."shopVariantId" = ${q.variantId}` : Prisma.empty}
    )`;
    const filter = Prisma.sql`WHERE (${q.type} = 'all' OR type = ${q.type === 'sale' ? 'SALE' : 'BUY'})
        AND (${q.search} = '' OR position(lower(${q.search}) in lower(name)) > 0)`;
    const [counts, totals] = await Promise.all([
        prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`${entries} SELECT count(*)::int AS total FROM entries ${filter}`),
        prisma.$queryRaw<Array<{ sales: number; purchases: number; due: number }>>(Prisma.sql`${entries}
            SELECT COALESCE(SUM(total) FILTER (WHERE type = 'SALE'), 0)::float8 AS sales,
              COALESCE(SUM(total) FILTER (WHERE type = 'BUY'), 0)::float8 AS purchases, COALESCE(SUM(due), 0)::float8 AS due FROM entries`),
    ]);
    const total = counts[0].total;
    const page = Math.min(q.page, Math.max(1, Math.ceil(total / 10)));
    const keys = await prisma.$queryRaw<Array<{ id: string; type: string }>>(Prisma.sql`${entries}
        SELECT id, type FROM entries ${filter} ORDER BY "createdAt" DESC, id DESC, type ASC LIMIT 10 OFFSET ${(page - 1) * 10}`);
    const [checkouts, purchases] = await Promise.all([
        prisma.checkout.findMany({ where: { tenantID: tenantId, shopID: q.shopId, id: { in: keys.filter(k => k.type === 'SALE').map(k => k.id) } },
            include: { items: { include: { Lot: { select: { buyPrice: true, shopVariantId: true } } } }, Debt: { select: { paidAmount: true, status: true } },
                buyer: { select: { name: true } }, soldByOwner: { select: { name: true } }, soldByEmployee: { select: { name: true } } } }),
        owner ? prisma.expenseItem.findMany({ where: { tenantID: tenantId, expense: { tenantID: tenantId, shopID: q.shopId }, id: { in: keys.filter(k => k.type === 'BUY').map(k => k.id) } },
            include: { supplier: { select: { supplierName: true } } } }) : Promise.resolve([]),
    ]);
    const units = q.variantId ? await prisma.$queryRaw<Array<{ units: number }>>(Prisma.sql`
        SELECT COALESCE(SUM(i.quantity), 0)::float8 AS units FROM checkout_items i
        JOIN checkouts c ON c.id = i."checkoutID" LEFT JOIN lot l ON l.id = i."lotId"
        WHERE ${validSales(tenantId, q.shopId)} AND i."tenantID" = ${tenantId} AND COALESCE(l."shopVariantId", i."variantId") = ${q.variantId}`) : [];
    return { checkouts, purchases, total, page, totals: totals[0], unitsSold: units[0]?.units };
}

async function expenses(tenantId: string, q: NavigationQuery) {
    const where: Prisma.ExpenseItemWhereInput = { tenantID: tenantId, expense: { tenantID: tenantId, shopID: q.shopId }, expenseType: { not: 'PRODUCT' } };
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [total, aggregate, month, categories] = await Promise.all([
        prisma.expenseItem.count({ where }), prisma.expenseItem.aggregate({ where, _sum: { amount: true } }),
        prisma.expenseItem.aggregate({ where: { ...where, createdAt: { gte: monthStart } }, _sum: { amount: true } }),
        prisma.expenseItem.groupBy({ by: ['expenseType'], where }),
    ]);
    const page = Math.min(q.page, Math.max(1, Math.ceil(total / 10)));
    const rows = await prisma.expenseItem.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 10, skip: (page - 1) * 10,
        select: { id: true, expenseType: true, amount: true, name: true, description: true, createdAt: true } });
    return { rows: rows.map(e => ({ id: e.id, category: e.expenseType, amount: e.amount, note: e.name || e.description, date: e.createdAt })),
        page, total, totalAmount: aggregate._sum.amount ?? 0, monthTotal: month._sum.amount ?? 0, categories: categories.length };
}

async function reports(tenantId: string, shopId: string) {
    const [months, totals, costs] = await Promise.all([
        prisma.$queryRaw<Array<{ key: string; total: number }>>(Prisma.sql`SELECT to_char(c."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM') AS key,
            SUM(c."totalPrice") AS total FROM checkouts c WHERE ${validSales(tenantId, shopId)} GROUP BY key ORDER BY key`),
        prisma.$queryRaw<Array<{ totalRevenue: number; weekRevenue: number; monthRevenue: number }>>(Prisma.sql`
            SELECT COALESCE(SUM(c."totalPrice"), 0)::float8 AS "totalRevenue",
              COALESCE(SUM(c."totalPrice") FILTER (WHERE c."createdAt" >= date_trunc('day', NOW() AT TIME ZONE 'UTC') - INTERVAL '6 days'), 0)::float8 AS "weekRevenue",
              COALESCE(SUM(c."totalPrice") FILTER (WHERE c."createdAt" >= date_trunc('month', NOW() AT TIME ZONE 'UTC')), 0)::float8 AS "monthRevenue"
            FROM checkouts c WHERE ${validSales(tenantId, shopId)}`),
        prisma.$queryRaw<Array<{ totalCost: number }>>(Prisma.sql`SELECT COALESCE(SUM(i.quantity * COALESCE(l."buyPrice", 0)), 0)::float8 AS "totalCost"
            FROM checkout_items i JOIN checkouts c ON c.id = i."checkoutID" LEFT JOIN lot l ON l.id = i."lotId"
            WHERE ${validSales(tenantId, shopId)} AND i."tenantID" = ${tenantId}`),
    ]);
    return { ...totals[0], totalCost: costs[0].totalCost, months };
}

export const navigationService = {
    async get(tenantId: string, section: string, q: NavigationQuery, owner: boolean) {
        await assertShop(tenantId, q.shopId);
        if (section === 'directories') return directories(tenantId, q.shopId, owner);
        if (section === 'transactions') return transactions(tenantId, q, owner);
        if (section === 'reports') return reports(tenantId, q.shopId);
        if (section === 'expenses' && owner) return expenses(tenantId, q);
        throw new ApiError(403, 'These records are available to the shop owner only');
    },
};
