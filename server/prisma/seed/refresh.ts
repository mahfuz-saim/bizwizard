import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { buildTransactionData, SeedAccount, seedId } from './transaction-data';

export function renewHistoryIds(data: ReturnType<typeof buildTransactionData>['data'], account: SeedAccount) {
    const prefix = `seed-v2-${account.key}-`;
    const generation = randomUUID();
    // Retained purchases must never be reused as a different generated lot.
    const history = [data.lots, data.losses, data.checkouts, data.items, data.debts,
        data.payments, data.ledger, data.expenseItems, data.pickups, data.pickupItems,
        data.attendance, data.notes];
    const ids = new Map<string, string>();
    for (const rows of history)
        for (const row of rows)
            ids.set(row.id!, `${prefix}${generation}-${row.id!.slice(prefix.length)}`);
    for (const rows of history)
        for (const row of rows)
            for (const [key, value] of Object.entries(row))
                if (typeof value === 'string' && ids.has(value))
                    (row as Record<string, unknown>)[key] = ids.get(value);
}

export async function clearGeneratedHistory(tx: Prisma.TransactionClient, account: SeedAccount) {
    const tenantID = seedId(account, 'tenant');
    const shopID = seedId(account, 'shop');
    const generated = { startsWith: `seed-v2-${account.key}-` };
    const external = { not: generated };
    const scoped = { tenantID, id: generated };
    const dependencies = await Promise.all([
        tx.checkoutItem.count({ where: { tenantID, id: external, checkoutID: generated } }),
        tx.debt.count({ where: { tenantID, id: external, checkoutID: generated } }),
        tx.debtPayments.count({ where: { id: external, debt: scoped } }),
        tx.pickupItem.count({ where: { tenantID, id: external, pickupID: generated } }),
        tx.buyerDebtLedger.count({ where: { tenantID, id: external, OR: [{ debtId: generated }, { checkoutId: generated }] } }),
        tx.treasuryActionEvidence.count({ where: { tenantID, shopID, paymentID: generated } }),
        tx.cashTransaction.count({ where: { tenantID, shopID, source: 'MANUAL', sourceRefID: generated } }),
    ]);
    if (dependencies.some(count => count > 0))
        throw new Error('Refresh refused: non-seed activity depends on generated sales, debts or payments. Existing data was preserved.');

    const settled = await tx.cashCommitment.findMany({
        where: { tenantID, shopID, paymentExpenseID: generated }, select: { paymentExpenseID: true },
    });
    const settledIds = settled.map(row => row.paymentExpenseID!);
    const retainedLots = await tx.lot.findMany({
        where: { ...scoped, ShopVariant: { shopID }, OR: [
            { CheckoutItem: { some: { id: external } } },
            { PickupItem: { some: { id: external } } },
            { ExpenseItem: { some: { OR: [{ id: external }, { id: { in: settledIds } }] } } },
            { LotDeletion: { some: { id: external } } },
        ] }, select: { id: true },
    });
    const lotIds = retainedLots.map(row => row.id);
    await tx.debtPayments.deleteMany({ where: { id: generated, debt: { tenantID, shopID } } });
    await tx.buyerDebtLedger.deleteMany({ where: { ...scoped, shopId: shopID } });
    await tx.pickupItem.deleteMany({ where: { ...scoped, pickup: { shopID } } });
    await tx.pickup.deleteMany({ where: { ...scoped, shopID } });
    await tx.checkoutItem.deleteMany({ where: { ...scoped, checkout: { shopID } } });
    await tx.debt.deleteMany({ where: { ...scoped, shopID } });
    await tx.checkout.deleteMany({ where: { ...scoped, shopID } });
    await tx.expenseItem.deleteMany({ where: {
        tenantID, expense: { shopID }, id: { ...generated, notIn: settledIds },
        OR: [{ lotId: null }, { lotId: { notIn: lotIds } }],
    } });
    await tx.lotDeletion.deleteMany({ where: { ...scoped, ShopVariant: { shopID }, lotId: { notIn: lotIds } } });
    await tx.lot.deleteMany({ where: { ...scoped, ShopVariant: { shopID }, id: { ...generated, notIn: lotIds } } });
    await tx.attendance.deleteMany({ where: scoped });
    await tx.note.deleteMany({ where: { ...scoped, shopID } });
}
