import assert from 'node:assert/strict';
import { AuthUtils } from '../../src/helpers/bcryptHelpers';
import {
    buildTransactionData,
    seedAccounts,
    seedId,
    SEED_PASSWORD,
} from './transaction-data';

const round = (value: number) => Math.round(value * 100) / 100;
const now = new Date('2026-10-16T14:30:00Z');
const accounts = seedAccounts.map(account =>
    buildTransactionData(account, now),
);
assert.equal(accounts[0].start.toISOString(), '2024-10-16T00:00:00.000Z');
assert.equal(accounts[1].start.toISOString(), '2026-10-10T00:00:00.000Z');

for (const [
    index,
    { data, start, tenantID, shopID, userID },
] of accounts.entries()) {
    const account = seedAccounts[index];
    assert.equal(data.inventory.length, 120);
    assert.equal(data.buyers.length, account.customers);
    assert.equal(data.suppliers.length, 8);
    const allIds = new Set<string>();
    for (const rows of Object.values(data))
        for (const row of rows) {
            assert(
                row.id && !allIds.has(row.id),
                `Duplicate/missing id ${row.id}`,
            );
            allIds.add(row.id);
            if ('tenantID' in row) assert.equal(row.tenantID, tenantID);
            if ('createdAt' in row && row.createdAt) {
                const date = new Date(row.createdAt);
                assert(
                    date >= start && date <= now,
                    `Out-of-range date ${date.toISOString()}`,
                );
            }
        }
    const buyers = new Set(data.buyers.map(b => b.userID));
    const inventories = new Map(data.inventory.map(p => [p.id, p]));
    const variants = new Map(data.variants.map(v => [v.id, v]));
    const lots = new Map(data.lots.map(l => [l.id, l]));
    const checkouts = new Map(data.checkouts.map(c => [c.id, c]));
    const itemsByCheckout = new Map<string, typeof data.items>();
    const soldByLot = new Map<string, number>();
    for (const item of data.items) {
        assert(checkouts.has(item.checkoutID));
        assert(inventories.has(item.inventoryId!));
        assert(variants.has(item.variantId!));
        const lot = lots.get(item.lotId!)!;
        assert(lot);
        assert.equal(lot.shopVariantId, item.variantId);
        assert(new Date(lot.createdAt!) <= new Date(item.createdAt!));
        assert.equal(
            item.discountedPrice,
            round(item.unitPrice - Number(item.itemDiscount)),
        );
        assert(item.quantity > 0);
        soldByLot.set(lot.id!, (soldByLot.get(lot.id!) || 0) + item.quantity);
        const items = itemsByCheckout.get(item.checkoutID) || [];
        items.push(item);
        itemsByCheckout.set(item.checkoutID, items);
    }
    const saleDays = new Set<string>();
    for (const checkout of data.checkouts) {
        if (checkout.soldBy === 'OWNER')
            assert.equal(checkout.soldByOwnerId, userID);
        else {
            assert.equal(checkout.soldBy, 'EMPLOYEE');
            assert(
                data.employees.some(
                    e => e.userID === checkout.soldByEmployeeId,
                ),
            );
            const date = new Date(checkout.createdAt!);
            const shift = data.attendance.find(
                a =>
                    a.employeeId === checkout.soldByEmployeeId &&
                    new Date(a.date!).toISOString().slice(0, 10) ===
                        date.toISOString().slice(0, 10),
            );
            assert(shift && shift.inStatus !== 'ABSENT');
            assert(new Date(shift.inTime!) <= date);
        }
        assert.equal(checkout.shopID, shopID);
        assert(buyers.has(checkout.buyerID!));
        const lines = itemsByCheckout.get(checkout.id!)!;
        assert(lines?.length);
        assert.equal(
            checkout.totalQuantity,
            lines.reduce((n, l) => n + l.quantity, 0),
        );
        assert.equal(
            checkout.totalPrice,
            round(
                lines.reduce((n, l) => n + l.discountedPrice * l.quantity, 0) -
                    Number(checkout.totalDiscount),
            ),
        );
        saleDays.add(new Date(checkout.createdAt!).toISOString().slice(0, 10));
    }
    assert.equal(saleDays.size, account.years ? 731 : 7);
    const activeBuyers = new Set(data.checkouts.map(c => c.buyerID));
    assert.equal(
        activeBuyers.size,
        data.buyers.length,
        'Every seeded customer must have purchase history',
    );
    assert(
        data.checkouts.length > activeBuyers.size,
        'Include returning customers',
    );
    const purchases = new Map(
        data.expenseItems
            .filter(i => i.expenseType === 'PRODUCT')
            .map(i => [i.lotId, i]),
    );
    const reservedByLot = new Map<string, number>();
    const pickupById = new Map(data.pickups.map(p => [p.id, p]));
    for (const item of data.pickupItems) {
        const pickup = pickupById.get(item.pickupID)!;
        assert(pickup);
        assert(data.buyers.some(b => b.id === pickup.buyerID));
        const lot = lots.get(item.lotId)!;
        assert(lot && new Date(lot.createdAt!) <= new Date(item.createdAt!));
        if (pickup.status !== 'CANCELED')
            reservedByLot.set(
                item.lotId,
                (reservedByLot.get(item.lotId) || 0) + item.quantity,
            );
    }
    for (const pickup of data.pickups) {
        const items = data.pickupItems.filter(i => i.pickupID === pickup.id);
        assert.equal(
            pickup.totalQuantity,
            items.reduce((n, i) => n + i.quantity, 0),
        );
        assert.equal(
            pickup.totalPrice,
            round(items.reduce((n, i) => n + i.unitPrice * i.quantity, 0)),
        );
    }
    const lossesByLot = new Map(data.losses.map(l => [l.lotId, l]));
    for (const loss of data.losses) {
        assert(lots.has(loss.lotId));
        assert.equal(
            loss.lossAmount,
            loss.lossType === 'NO_LOSS' ? 0 : round(loss.stock * loss.buyPrice),
        );
    }
    for (const lot of data.lots) {
        assert(lot.stock >= 0);
        const purchase = purchases.get(lot.id)!;
        assert(purchase);
        assert.equal(
            lot.stock +
                (soldByLot.get(lot.id!) || 0) +
                (reservedByLot.get(lot.id!) || 0) +
                (lossesByLot.get(lot.id!)?.stock || 0),
            purchase.quantity,
        );
        assert.equal(purchase.amount, round(purchase.quantity! * lot.buyPrice));
        assert.equal(
            lot.status,
            lossesByLot.has(lot.id!)
                ? 'DELETED'
                : lot.stock === 0
                  ? 'SOLD'
                  : 'ACTIVE',
        );
    }
    for (const variant of data.variants)
        assert.equal(
            variant.totalProducts,
            data.lots
                .filter(l => l.shopVariantId === variant.id)
                .reduce((n, l) => n + l.stock, 0),
        );
    // Prove that both windows include actual sell-through followed by buying
    // the same products again, rather than only initial inventory deposits.
    const repeatPurchases = data.variants.filter(
        v => data.lots.filter(l => l.shopVariantId === v.id).length > 1,
    );
    assert(
        repeatPurchases.length >= 10,
        'Expected repeat purchases in both accounts',
    );
    assert(
        data.lots.some(
            lot =>
                new Date(lot.createdAt!) > start &&
                data.items.some(
                    item =>
                        item.variantId === lot.shopVariantId &&
                        new Date(item.createdAt!) < new Date(lot.createdAt!),
                ),
        ),
        'A sold product must be purchased again later',
    );
    assert(data.checkouts.some(c => c.soldBy === 'EMPLOYEE'));
    assert(data.pickups.some(p => p.status === 'COMPLETE'));
    assert(data.pickups.some(p => p.status === 'CANCELED'));
    assert(data.losses.some(l => l.reason === 'DAMAGED'));
    assert(data.losses.some(l => l.reason === 'RETURNED'));
    assert(data.pickups.some(p => p.status === 'PENDING'));
    assert(data.pickups.some(p => p.status === 'PROCESSING'));
    assert(data.debts.some(d => d.status === 'PAID'));
    assert(data.debts.some(d => d.status === 'UNPAID'));
    assert(data.debts.some(d => d.status === 'PARTIALLY_PAID'));
    assert(data.notes.length > 0);
    assert.equal(data.attendance.length, saleDays.size * data.employees.length);
    assert(
        data.payments.some(p => {
            const debt = data.debts.find(d => d.id === p.debtId)!;
            return new Date(p.createdAt!) > new Date(debt.createdAt!);
        }),
        'Customers should come back on later days to repay credit',
    );
    const purchaseMonths = new Set(
        data.lots.map(l => new Date(l.createdAt!).toISOString().slice(0, 7)),
    );
    const saleMonths = new Set(
        data.checkouts.map(c =>
            new Date(c.createdAt!).toISOString().slice(0, 7),
        ),
    );
    assert.deepEqual(purchaseMonths, saleMonths);
    const expectedDebtBalances = new Map<string, number>();
    for (const debt of data.debts) {
        const checkout = checkouts.get(debt.checkoutID)!;
        const payments = data.payments.filter(p => p.debtId === debt.id);
        const paid = round(payments.reduce((n, p) => n + p.amount, 0));
        assert.equal(paid, debt.paidAmount);
        assert(paid <= checkout.totalPrice);
        assert.equal(
            checkout.status,
            debt.status === 'PAID' ? 'PAID' : paid ? 'PENDING' : 'UNPAID',
        );
        expectedDebtBalances.set(
            debt.buyerID,
            round(
                (expectedDebtBalances.get(debt.buyerID) || 0) +
                    checkout.totalPrice -
                    paid,
            ),
        );
        for (const payment of payments)
            assert(
                new Date(payment.createdAt!) >= new Date(checkout.createdAt!),
            );
    }
    const balances = new Map<string, number>();
    let lastTime = 0;
    for (const row of data.ledger) {
        const time = new Date(row.createdAt!).getTime();
        assert(time >= lastTime);
        lastTime = time;
        assert.equal(row.previousBalance, balances.get(row.buyerId) || 0);
        assert.equal(
            row.newBalance,
            round(
                row.previousBalance +
                    (row.type === 'DEBT_CREATED' ? row.amount : -row.amount),
            ),
        );
        assert(row.newBalance >= 0);
        balances.set(row.buyerId, row.newBalance);
    }
    assert.deepEqual(balances, expectedDebtBalances);
    for (const expense of data.expenses) {
        const items = data.expenseItems.filter(i => i.expenseID === expense.id);
        assert.equal(
            expense.totalAmount,
            round(items.reduce((n, i) => n + i.amount, 0)),
        );
        for (const item of items) {
            const date = new Date(item.createdAt!);
            assert.equal(date.getUTCMonth() + 1, expense.month);
            assert.equal(date.getUTCFullYear(), expense.year);
        }
    }
    console.log(
        `${account.email}: validated ${data.checkouts.length} sales over ${saleDays.size} days, ${data.items.length} lines, ${data.lots.length} purchases, ${data.debts.length} debts, ${repeatPurchases.length} re-purchased products, ${data.pickups.length} pickups, ${data.losses.length} stock adjustments.`,
    );
}
assert.notEqual(
    seedId(seedAccounts[0], 'user'),
    seedId(seedAccounts[1], 'user'),
);
const repeat = buildTransactionData(seedAccounts[1], now);
assert.deepEqual(repeat, accounts[1]);
// Calendar-year boundaries remain correct when the interval includes leap day.
const leap = buildTransactionData(
    seedAccounts[0],
    new Date('2024-02-29T10:00:00Z'),
);
assert.equal(leap.start.toISOString(), '2022-03-01T00:00:00.000Z');
console.log('All transaction seed integrity checks passed.');

async function checkLoginPassword() {
    const { hash, salt } = await AuthUtils.hashedPassword(SEED_PASSWORD);
    assert(await AuthUtils.comparePasswords(SEED_PASSWORD, hash, salt));
    assert.equal(
        await AuthUtils.comparePasswords('wrong-password', hash, salt),
        false,
    );
    console.log('Seed password verified with backend login hashing.');
}
void checkLoginPassword().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
