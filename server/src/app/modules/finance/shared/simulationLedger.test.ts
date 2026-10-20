import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Prisma } from '@prisma/client';
import { simulationCashRows, simulationContext, type SimulationCashRow } from './database';
import { loadCashTransactions } from './shopData';
import { refreshBalances } from '../cashflow/cashflow.service';
import { roundCurrency } from './money';

const row = (amount: number, date: string, status: SimulationCashRow['status'] = 'CLEARED'): SimulationCashRow => ({
  accountID: 'account', direction: 'IN', amount, category: 'SALES_COLLECTION', occurredAt: new Date(date), status,
});

test('simulation ledger keeps per-step balances and newly appended rows without rereading history', async () => {
  const rows = [row(0.105, '2026-10-01'), row(0.105, '2026-10-03'), row(100, '2026-10-02', 'PENDING')];
  let reads = 0;
  const client = {
    cashAccount: {
      findMany: async () => [{ id: 'account', openingBalance: 0, currentBalance: 0 }],
      update: async () => ({}),
    },
    cashTransaction: { findMany: async () => { reads++; throw new Error('Unexpected ledger read'); } },
  };
  const context = { client: client as unknown as Prisma.TransactionClient, asOf: new Date('2026-10-03'),
    cashLedger: { tenantID: 'tenant', shopID: 'demo', rows } };
  await simulationContext.run(context, async () => {
    const expected = rows.filter(r => r.status === 'CLEARED').reduce((balance, r) => roundCurrency(balance + r.amount), 0);
    assert.equal((await refreshBalances('tenant', 'demo'))[0].currentBalance, expected);
    assert.notEqual(expected, roundCurrency(0.105 + 0.105), 'round each step, not just the final sum');
    rows.push({ ...row(0.03, '2026-10-03'), direction: 'OUT' });
    assert.equal((await refreshBalances('tenant', 'demo'))[0].currentBalance, roundCurrency(expected - 0.03));
    assert.equal(simulationCashRows('other-tenant', 'demo'), undefined);
    assert.equal(simulationCashRows('tenant', 'other-shop'), undefined);
  });
  assert.equal(reads, 0);
  assert.equal(simulationCashRows('tenant', 'demo'), undefined, 'snapshot cannot escape its transaction');
});

test('cached history is date-filtered and sorted without mutating the private ledger', async () => {
  const rows = [row(3, '2026-10-03'), row(1, '2026-10-01'), row(4, '2026-10-04'), row(2, '2026-10-02', 'PENDING')];
  const context = { client: {} as Prisma.TransactionClient, asOf: new Date('2026-10-03'),
    cashLedger: { tenantID: 'tenant', shopID: 'demo', rows } };
  await simulationContext.run(context, async () => {
    const history = await loadCashTransactions('tenant', 'demo', 1);
    assert.deepEqual(history.map(r => r.amount), [2, 3]);
    assert.deepEqual(rows.map(r => r.amount), [3, 1, 4, 2]);
    context.asOf = new Date('2026-10-04');
    assert.deepEqual((await loadCashTransactions('tenant', 'demo', 1)).map(r => r.amount), [3, 4]);
  });
});

test('uncached finance reads still use the database and retain tenant/shop boundaries', async () => {
  let query: unknown;
  const client = { cashTransaction: { findMany: async (args: unknown) => { query = args; return []; } } };
  const asOf = new Date('2026-10-03');
  await simulationContext.run({ client: client as unknown as Prisma.TransactionClient, asOf }, async () => {
    assert.deepEqual(await loadCashTransactions('tenant', 'source', 1), []);
  });
  assert.deepEqual(query, { where: { tenantID: 'tenant', shopID: 'source', occurredAt: { gte: new Date('2026-10-02'), lte: asOf } }, orderBy: { occurredAt: 'asc' } });
});
