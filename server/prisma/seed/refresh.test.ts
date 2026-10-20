import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTransactionData, seedAccounts } from './transaction-data';
import { renewHistoryIds } from './refresh';

test('refreshed history has new IDs while catalog and account identities stay fixed', () => {
    const account = seedAccounts[1];
    const { data } = buildTransactionData(account, new Date('2026-10-20T09:00:00Z'));
    const original = structuredClone(data);
    renewHistoryIds(data, account);
    assert.deepEqual(data.inventory, original.inventory);
    assert.deepEqual(data.variants, original.variants);
    assert.deepEqual(data.buyers, original.buyers);
    assert.deepEqual(data.expenses, original.expenses);
    const oldIds = new Set(original.lots.map(row => row.id));
    assert.ok(data.lots.every(row => !oldIds.has(row.id)));
    const lots = new Set(data.lots.map(row => row.id));
    const checkouts = new Set(data.checkouts.map(row => row.id));
    const debts = new Set(data.debts.map(row => row.id));
    assert.ok(data.items.every(row => lots.has(row.lotId!) && checkouts.has(row.checkoutID)));
    assert.ok(data.debts.every(row => checkouts.has(row.checkoutID)));
    assert.ok(data.payments.every(row => debts.has(row.debtId)));
    assert.ok(data.expenseItems.filter(row => row.lotId).every(row => lots.has(row.lotId!)));
    assert.ok(data.losses.every(row => lots.has(row.lotId)));
});
