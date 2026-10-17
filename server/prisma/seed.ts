import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuthUtils } from '../src/helpers/bcryptHelpers';
import {
    buildTransactionData,
    SEED_PASSWORD,
    seedAccounts,
    seedId,
    SeedAccount,
} from './seed/transaction-data';

const prisma = new PrismaClient();

// Only the known fixture namespace is replaceable. No global deleteMany calls.
// Foreign-key conflicts with new, manually-created activity abort and roll back,
// rather than cascading into another shop's records.
async function clearGeneratedHistory(
    tx: Prisma.TransactionClient,
    account: SeedAccount,
) {
    const tenantID = seedId(account, 'tenant');
    const generated = { startsWith: `seed-v2-${account.key}-` };
    const scoped = { tenantID, id: generated };
    await tx.debtPayments.deleteMany({
        where: { id: generated, debt: { tenantID } },
    });
    await tx.buyerDebtLedger.deleteMany({ where: scoped });
    await tx.pickupItem.deleteMany({ where: scoped });
    await tx.pickup.deleteMany({ where: scoped });
    await tx.checkoutItem.deleteMany({ where: scoped });
    await tx.debt.deleteMany({ where: scoped });
    await tx.checkout.deleteMany({ where: scoped });
    await tx.expenseItem.deleteMany({ where: scoped });
    await tx.expense.deleteMany({ where: scoped });
    await tx.lotDeletion.deleteMany({ where: scoped });
    await tx.lot.deleteMany({ where: scoped });
    await tx.shopVariant.deleteMany({ where: scoped });
    await tx.inventory.deleteMany({
        where: { id: generated, isPrivate: true },
    });
    await tx.attendance.deleteMany({ where: scoped });
    await tx.note.deleteMany({ where: scoped });
}

async function seedAccount(account: SeedAccount, now: Date, refresh: boolean) {
    const userID = seedId(account, 'user');
    const existing = await prisma.user.findUnique({
        where: { email: account.email },
    });
    if (existing) {
        if (existing.id !== userID) {
            throw new Error(
                `Refusing to overwrite existing non-seed account ${account.email}. Use a separate development database.`,
            );
        }
        if (!refresh) {
            console.log(
                `${account.email}: already seeded. Use npm run seed -- --refresh to rebuild its demo history; existing data/password are otherwise preserved.`,
            );
            return;
        }
    }
    console.log(
        `Generating ${account.email} (${account.years ? 'two years' : 'one week'})...`,
    );
    const { data, start, tenantID, shopID } = buildTransactionData(
        account,
        now,
    );
    const { hash, salt } = await AuthUtils.hashedPassword(SEED_PASSWORD);
    // Each account is atomic. On failure no partial shop/history is left behind.
    // Chunk bulk inserts to stay well below PostgreSQL's bind-parameter limit.
    async function chunks<T>(
        rows: T[],
        insert: (batch: T[]) => Promise<unknown>,
    ) {
        for (let i = 0; i < rows.length; i += 500)
            await insert(rows.slice(i, i + 500));
    }
    await prisma.$transaction(
        async tx => {
            if (existing) {
                await clearGeneratedHistory(tx, account);
            } else {
                await tx.user.create({
                    data: {
                        id: userID,
                        email: account.email,
                        number: account.number,
                        name: account.name,
                        password: hash,
                        passwordSalt: salt,
                        role: ['OWNER'],
                        status: 'ACTIVE',
                        OTP: 0,
                        createdAt: start,
                        updatedAt: start,
                    },
                });
                await tx.owner.create({
                    data: {
                        id: seedId(account, 'owner'),
                        userID,
                        email: account.email,
                        number: account.number,
                        name: account.name,
                        dob: '1988-04-12',
                        address: 'Gazipur, Dhaka Division',
                        createdAt: start,
                        updatedAt: start,
                    },
                });
                await tx.tenant.create({
                    data: {
                        id: tenantID,
                        name: account.shop,
                        code: `SEED-V2-${account.key.toUpperCase()}`,
                        ownerID: userID,
                        createdAt: start,
                        updatedAt: start,
                    },
                });
                await tx.shop.create({
                    data: {
                        id: shopID,
                        shopName: account.shop,
                        contact: account.number,
                        category: 'GROCERY',
                        shopCode: `SEED-V2-${account.key.toUpperCase()}`,
                        tenantID,
                        ownerID: userID,
                        createdAt: start,
                        updatedAt: start,
                        address: {
                            create: {
                                tenantID,
                                street: 'Market Road',
                                upazila: 'Gazipur Sadar',
                                district: 'Gazipur',
                            },
                        },
                    },
                });
                await tx.shopConfig.create({
                    data: {
                        shopID,
                        tenantID,
                        createdAt: start,
                        updatedAt: start,
                    },
                });
            }
            await chunks(data.users, batch =>
                tx.user.createMany({ data: batch, skipDuplicates: true }),
            );
            await chunks(data.buyers, batch =>
                tx.buyer.createMany({ data: batch, skipDuplicates: true }),
            );
            await chunks(data.shopBuyers, batch =>
                tx.shopBuyer.createMany({ data: batch, skipDuplicates: true }),
            );
            await chunks(data.suppliers, batch =>
                tx.supplier.createMany({ data: batch, skipDuplicates: true }),
            );
            await chunks(data.shopSuppliers, batch =>
                tx.shopSupplier.createMany({
                    data: batch,
                    skipDuplicates: true,
                }),
            );
            await chunks(data.employees, batch =>
                tx.employee.createMany({ data: batch, skipDuplicates: true }),
            );
            await chunks(data.attendance, batch =>
                tx.attendance.createMany({ data: batch }),
            );
            await chunks(data.notes, batch =>
                tx.note.createMany({ data: batch }),
            );
            for (const supplier of data.shopSuppliers) {
                await tx.shopSupplier.update({
                    where: { id: supplier.id },
                    data: { lastSuppliedAt: supplier.lastSuppliedAt },
                });
            }
            await chunks(data.inventory, batch =>
                tx.inventory.createMany({ data: batch }),
            );
            await chunks(data.variants, batch =>
                tx.shopVariant.createMany({ data: batch }),
            );
            await chunks(data.lots, batch =>
                tx.lot.createMany({ data: batch }),
            );
            await chunks(data.losses, batch =>
                tx.lotDeletion.createMany({ data: batch }),
            );
            await chunks(data.pickups, batch =>
                tx.pickup.createMany({ data: batch }),
            );
            await chunks(data.pickupItems, batch =>
                tx.pickupItem.createMany({ data: batch }),
            );
            await chunks(data.checkouts, batch =>
                tx.checkout.createMany({ data: batch }),
            );
            await chunks(data.items, batch =>
                tx.checkoutItem.createMany({ data: batch }),
            );
            await chunks(data.debts, batch =>
                tx.debt.createMany({ data: batch }),
            );
            await chunks(data.payments, batch =>
                tx.debtPayments.createMany({ data: batch }),
            );
            await chunks(data.ledger, batch =>
                tx.buyerDebtLedger.createMany({ data: batch }),
            );
            await chunks(data.expenses, batch =>
                tx.expense.createMany({ data: batch }),
            );
            await chunks(data.expenseItems, batch =>
                tx.expenseItem.createMany({ data: batch }),
            );
        },
        { maxWait: 10000, timeout: 180000 },
    );
    console.log(
        `${account.email}: ${data.inventory.length} products, ${data.buyers.length} customers, ${data.checkouts.length} sales, ${data.lots.length} purchases, ${data.debts.length} credit sales, ${data.expenses.length} expense months, ${data.pickups.length} pickup orders, ${data.losses.length} stock adjustments, ${data.attendance.length} attendance records (${start.toISOString()} – ${now.toISOString()}).`,
    );
}

async function main() {
    const args = process.argv.slice(2);
    if (
        process.env.NODE_ENV === 'production' &&
        !args.includes('--allow-public-demo-accounts')
    ) {
        throw new Error(
            'Development seed accounts have public passwords. Refusing to seed in production without --allow-public-demo-accounts.',
        );
    }
    if (!process.env.DATABASE_URL)
        throw new Error(
            'Set DATABASE_URL in server/.env before running npm run seed.',
        );
    if (
        args.some(arg =>
            !['--refresh', '--allow-public-demo-accounts'].includes(arg),
        )
    )
        throw new Error(
            'Only --refresh and --allow-public-demo-accounts are supported.',
        );
    const refresh = args.includes('--refresh');
    if (refresh)
        console.warn(
            'REFRESH: replacing generated activity for the two seed shops only. Seed-account profile/password and other accounts are preserved.',
        );
    const now = new Date();
    for (const account of seedAccounts)
        await seedAccount(account, now, refresh);
    console.log('Seed complete. New accounts use password: ' + SEED_PASSWORD);
}

main()
    .catch(error => {
        console.error('Seed failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
