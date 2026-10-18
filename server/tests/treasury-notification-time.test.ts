import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import prisma from '../src/shared/prisma';
import { cashflowService } from '../src/app/modules/finance/cashflow/cashflow.service';

function stub(t: TestContext, target: object, name: string, implementation: (...args: never[]) => unknown) {
    const original = Reflect.get(target, name);
    const fn = t.mock.fn(implementation);
    Reflect.set(target, name, fn);
    t.after(() => { Reflect.set(target, name, original); });
    return fn;
}

for (const simulated of [false, true]) {
    for (const existing of [false, true]) {
        test(`treasury notification clock (simulated=${simulated}, existing=${existing})`, async t => {
            for (const model of [prisma.cashTransaction, prisma.cashCommitment, prisma.checkout, prisma.checkoutItem,
                prisma.expenseItem, prisma.debt, prisma.lot, prisma.cashAccount, prisma.financingApplication]) {
                stub(t, model, 'findMany', async () => []);
            }
            stub(t, prisma.checkout, 'findFirst', async () => null);
            stub(t, prisma.aiAgentPolicy, 'upsert', async () => ({}));
            stub(t, prisma.aiAgentPolicy, 'findFirst', async () => null);
            stub(t, cashflowService, 'getProjection', async () => ({
                currentCash: 0, daysOfBuffer: 0, dailyBuckets: [], shortfallDate: new Date().toISOString().slice(0, 10), shortfallAmount: 100,
            }));
            const auditTime = new Date('2026-10-18T09:00:00Z');
            stub(t, prisma.cashAlert, 'findFirst', async () => existing ? { id: 'existing-real-alert' } : null);
            stub(t, prisma.cashAlert, 'create', async () => ({ id: 'alert', createdAt: auditTime }));
            stub(t, prisma.cashAlert, 'update', async () => ({}));
            const create = stub(t, prisma.notification, 'create', async () => ({ id: 'notification' }));
            const simulation = simulated ? { runID: 'run-1', occurredAt: new Date('2026-10-12T12:00:00Z') } : undefined;

            await cashflowService.runTreasury('tenant', 'shop', simulation);

            if (existing) {
                assert.equal(create.mock.callCount(), 0);
                return;
            }
            assert.equal(create.mock.callCount(), 1);
            const args = create.mock.calls[0].arguments[0] as { data: { createdAt?: Date; data: Record<string, unknown> } };
            assert.equal(args.data.createdAt, undefined);
            assert.deepEqual(args.data.data, {
                alertID: 'alert', source: 'finance-copilot',
                ...(simulated ? { simulationRunID: 'run-1', simulationOccurredAt: '2026-10-12T12:00:00.000Z' } : {}),
            });
        });
    }
}
