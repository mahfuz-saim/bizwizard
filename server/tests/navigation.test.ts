import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import prisma from '../src/shared/prisma';
import { navigationService } from '../src/app/modules/analytics/navigation.service';

function stub(t: TestContext, target: object, name: string, fn: (...args: never[]) => unknown) {
    const previous = Reflect.get(target, name);
    const mock = t.mock.fn(fn);
    Reflect.set(target, name, mock);
    t.after(() => Reflect.set(target, name, previous));
    return mock;
}
const query = { shopId: 'shop', page: 2, search: "' OR 1=1 --", type: 'all' as const };

test('navigation rejects foreign shops before querying history', async t => {
    stub(t, prisma.shop, 'findFirst', async () => null);
    const raw = stub(t, prisma, '$queryRaw', async () => []);
    await assert.rejects(() => navigationService.get('tenant', 'transactions', query, true), /Shop not found/);
    assert.equal(raw.mock.callCount(), 0);
});

test('employees cannot read operating expenses', async t => {
    stub(t, prisma.shop, 'findFirst', async () => ({ id: 'shop' }));
    const rows = stub(t, prisma.expenseItem, 'findMany', async () => []);
    await assert.rejects(() => navigationService.get('tenant', 'expenses', query, false), /owner only/);
    assert.equal(rows.mock.callCount(), 0);
});

for (const owner of [true, false]) {
    test(`transaction requests read only a bounded page and parameterize filters (owner=${owner})`, async t => {
        stub(t, prisma.shop, 'findFirst', async () => ({ id: 'shop' }));
        const raw = stub(t, prisma, '$queryRaw', async (sql: { text: string; values: unknown[] }) => {
            assert(sql.values.includes('tenant') && sql.values.includes('shop'));
            assert(!sql.text.includes(query.search));
            if (sql.text.includes('count(*)')) return [{ total: 15529 }];
            if (sql.text.includes('FILTER')) return [{ sales: 1000000, purchases: 200000, due: 12345 }];
            assert(sql.text.includes('LIMIT 10 OFFSET'));
            assert(sql.values.includes(10));
            assert(sql.values.includes(owner));
            return [{ id: 'sale-11', type: 'SALE' }];
        });
        const sales = stub(t, prisma.checkout, 'findMany', async () => []);
        const purchases = stub(t, prisma.expenseItem, 'findMany', async () => []);
        const result = await navigationService.get('tenant', 'transactions', query, owner);
        assert('totals' in result);
        assert.equal(result.page, 2);
        assert.equal(result.total, 15529);
        assert.equal(result.totals.due, 12345);
        assert.equal(raw.mock.callCount(), 3);
        const args = sales.mock.calls[0].arguments[0] as { where: { tenantID: string; shopID: string; id: { in: string[] } } };
        assert.deepEqual(args.where, { tenantID: 'tenant', shopID: 'shop', id: { in: ['sale-11'] } });
        assert.equal(purchases.mock.callCount(), owner ? 1 : 0);
    });
}

test('empty transaction history clamps pagination and still returns global totals', async t => {
    stub(t, prisma.shop, 'findFirst', async () => ({ id: 'shop' }));
    stub(t, prisma, '$queryRaw', async (sql: { text: string }) => {
        if (sql.text.includes('count(*)')) return [{ total: 0 }];
        if (sql.text.includes('FILTER')) return [{ sales: 0, purchases: 0, due: 0 }];
        return [];
    });
    stub(t, prisma.checkout, 'findMany', async () => []);
    const result = await navigationService.get('tenant', 'transactions', query, false);
    assert('totals' in result);
    assert.equal(result.page, 1);
    assert.equal(result.total, 0);
});
