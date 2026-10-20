import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient, type CheckoutItem } from '@prisma/client';
import { seedAccount } from '../seed';
import { seedAccounts, seedId } from './transaction-data';

for (const account of [seedAccounts[1], seedAccounts[0]]) test(`seed refresh (${account.key}) keeps added sales, purchase evidence, stock links and unrelated shops`, {
    skip: process.env.SEED_REFRESH_TEST_DATABASE !== '1',
}, async t => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.equal(url.hostname, '127.0.0.1');
    assert.equal(url.pathname, '/simulator_test');
    const db = new PrismaClient();
    t.after(() => db.$disconnect());
    const tenantID = seedId(account, 'tenant');
    const shopID = seedId(account, 'shop');
    const scope = { tenantID, shopID };
    await seedAccount(account, new Date('2026-10-17T09:00:00Z'), false, db);
    const ownerBefore = await db.user.findUniqueOrThrow({ where: { id: seedId(account, 'user') } });
    const lot = await db.lot.findFirstOrThrow({ where: { tenantID, ShopVariant: { shopID }, stock: { gte: 2 }, status: 'ACTIVE' } });
    const items: CheckoutItem[] = [];
    for (let i = 0; i < 2; i++) {
        const sale = await db.checkout.create({ data: { ...scope, totalPrice: lot.sellPrice, totalQuantity: 1, status: 'PAID', createdAt: new Date('2026-10-18T09:00:00Z') } });
        items.push(await db.checkoutItem.create({ data: { tenantID, checkoutID: sale.id, lotId: lot.id, variantId: lot.shopVariantId,
            productName: 'Added sale', quantity: 1, unitPrice: lot.sellPrice, discountedPrice: lot.sellPrice } }));
    }
    await db.lot.update({ where: { id: lot.id }, data: { stock: { decrement: 2 } } });
    const savedLot = await db.lot.findUniqueOrThrow({ where: { id: lot.id } });
    const purchase = await db.expenseItem.findFirstOrThrow({ where: { tenantID, lotId: lot.id } });
    const settlement = await db.cashCommitment.create({ data: { ...scope, name: 'Settled fixture invoice', category: 'PRODUCT_PURCHASE',
        amount: purchase.amount, dueDate: purchase.createdAt, supplierPayable: true, isPaid: true, paymentExpenseID: purchase.id } });
    const expense = await db.expenseItem.create({ data: { tenantID, expenseID: purchase.expenseID, name: 'Added expense', amount: 25 } });
    const otherShop = await db.shop.create({ data: { tenantID, ownerID: ownerBefore.id, shopName: 'Unrelated shop', contact: 'Fixture' } });
    const otherSale = await db.checkout.create({ data: { tenantID, shopID: otherShop.id, totalPrice: 5, totalQuantity: 1, status: 'PAID' } });
    const copiedShop = await db.shop.create({ data: { tenantID, ownerID: ownerBefore.id, shopName: 'Saved demo copy', contact: 'Fixture',
        simulationSourceShopID: shopID, simulationBaselineAt: new Date('2026-10-17'), simulationAsOf: new Date('2026-11-16') } });
    async function assertPreserved() {
        assert.deepEqual(await db.user.findUniqueOrThrow({ where: { id: ownerBefore.id } }), ownerBefore);
        assert.deepEqual(await db.lot.findUniqueOrThrow({ where: { id: lot.id } }), savedLot);
        assert.deepEqual(await db.expenseItem.findUniqueOrThrow({ where: { id: purchase.id } }), purchase);
        assert.deepEqual(await db.expenseItem.findUniqueOrThrow({ where: { id: expense.id } }), expense);
        assert.deepEqual(await db.cashCommitment.findUniqueOrThrow({ where: { id: settlement.id } }), settlement);
        for (const item of items) assert.deepEqual(await db.checkoutItem.findUniqueOrThrow({ where: { id: item.id } }), item);
        assert.deepEqual(await db.checkout.findUniqueOrThrow({ where: { id: otherSale.id } }), otherSale);
        assert.deepEqual(await db.shop.findUniqueOrThrow({ where: { id: copiedShop.id } }), copiedShop);
        for (const bucket of await db.expense.findMany({ where: scope })) {
            const sum = await db.expenseItem.aggregate({ where: { expenseID: bucket.id }, _sum: { amount: true } });
            assert.ok(Math.abs(bucket.totalAmount - (sum._sum.amount ?? 0)) < 0.001);
        }
        for (const variant of await db.shopVariant.findMany({ where: scope })) {
            const sum = await db.lot.aggregate({ where: { shopVariantId: variant.id }, _sum: { stock: true } });
            assert.equal(variant.totalProducts, sum._sum.stock ?? 0);
        }
        const erroneousSales = await db.cashTransaction.count({ where: { ...scope, source: 'SALE', sourceRefID: {
            in: (await db.debt.findMany({ where: scope, select: { checkoutID: true } })).map(row => row.checkoutID),
        } } });
        assert.equal(erroneousSales, 0, 'paid credit sales are not counted again as cash sales');
    }
    for (const date of ['2026-10-20T09:00:00Z', '2026-11-02T09:00:00Z']) {
        await seedAccount(account, new Date(date), true, db);
        await assertPreserved();
        const midnight = new Date(date.slice(0, 10));
        assert.ok(await db.checkout.count({ where: { ...scope, createdAt: { gte: midnight, lte: new Date(date) } } }));
        assert.ok(await db.checkout.count({ where: { ...scope, createdAt: { gte: new Date(midnight.getTime() - 86400000), lt: midnight } } }));
    }
    const seededDebt = await db.debt.findFirstOrThrow({ where: scope });
    await db.debtPayments.create({ data: { id: randomUUID(), debtId: seededDebt.id, amount: 1 } });
    const before = await db.checkout.findMany({ where: scope, orderBy: { id: 'asc' } });
    await assert.rejects(seedAccount(account, new Date('2026-11-03T09:00:00Z'), true, db), /Refresh refused/);
    assert.deepEqual(await db.checkout.findMany({ where: scope, orderBy: { id: 'asc' } }), before);
});
