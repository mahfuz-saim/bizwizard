import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import type { Prisma } from '@prisma/client';
import prisma from '../src/shared/prisma';
import { analyticsService } from '../src/app/modules/analytics/analytics.service';

function stub<F extends (...args: never[]) => unknown>(t: TestContext, target: object, name: string, implementation: F) {
    const original = Reflect.get(target, name);
    const fn = t.mock.fn(implementation);
    Reflect.set(target, name, fn);
    t.after(() => { Reflect.set(target, name, original); });
    return fn;
}

for (const owner of [true, false]) {
    test(`dashboard preserves full totals with bounded recent history (owner=${owner})`, async t => {
        stub(t, prisma.shop, 'findFirst', async () => ({ id: 'shop' }));
        const tx = {
            expenseItem: { aggregate: async () => ({ _sum: { amount: 0 } }) },
            checkout: { aggregate: async () => ({ _sum: { totalPrice: 175, totalDiscount: 5 } }) },
            lotDeletion: { aggregate: async () => ({ _sum: { lossAmount: 0 } }) },
            debt: { findMany: async () => [] },
            checkoutItem: { findMany: async () => [{ quantity: 2, Lot: { buyPrice: 60 } }] },
        };
        stub(t, prisma, '$transaction', async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(tx as unknown as Prisma.TransactionClient));
        stub(t, prisma.shopBuyer, 'findMany', async () => [{ buyerID: 'customer' }]);
        stub(t, prisma.shopSupplier, 'count', async () => 3);
        const sales = stub(t, prisma.checkout, 'findMany', async (args: Prisma.CheckoutFindManyArgs) => args.take ? [] : [
            { totalDiscount: 5, items: [{ unitPrice: 100, discountedPrice: 90, quantity: 2 }] },
        ]);
        const purchases = stub(t, prisma.expenseItem, 'findMany', async () => []);
        const debts = stub(t, prisma.debt, 'findMany', async (_args: Prisma.DebtFindManyArgs) => [
            { paidAmount: 75, checkout: { totalPrice: 175 } },
            { paidAmount: 250, checkout: { totalPrice: 200 } },
        ]);
        const data = await analyticsService.getDashboard('tenant', 'shop', owner);
        assert.equal(data.today.totalSell, 175);
        assert.equal(data.today.profit, 55);
        assert.equal(data.todayDiscount, 25);
        assert.equal(data.outstandingDebt, 100);
        assert.equal(data.totalCustomers, 1);
        assert.equal(data.totalSuppliers, 3);
        assert.equal(sales.mock.calls[0].arguments[0].take, 10);
        assert.equal(purchases.mock.callCount(), owner ? 1 : 0);
        assert.deepEqual(debts.mock.calls[0].arguments[0].where?.checkout, {
            tenantID: 'tenant', shopID: 'shop', isDraft: false,
            status: { in: ['PAID', 'UNPAID', 'PENDING'] }, buyerID: { in: ['customer'] },
        });
    });
}

test('dashboard rejects a shop outside the requested tenant before loading data', async t => {
    stub(t, prisma.shop, 'findFirst', async () => null);
    const query = stub(t, prisma.checkout, 'findMany', async () => []);
    await assert.rejects(analyticsService.getDashboard('tenant', 'other-shop', true), { statusCode: 404 });
    assert.equal(query.mock.callCount(), 0);
});
