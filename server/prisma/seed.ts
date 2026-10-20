import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuthUtils } from '../src/helpers/bcryptHelpers';
import { clearGeneratedHistory, renewHistoryIds } from './seed/refresh';
import {
    buildTransactionData,
    SEED_PASSWORD,
    seedAccounts,
    seedId,
    SeedAccount,
} from './seed/transaction-data';

const prisma = new PrismaClient();

export async function seedAccount(account: SeedAccount, now: Date, refresh: boolean, client: PrismaClient) {
    const userID = seedId(account, 'user');
    const existing = await client.user.findUnique({
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
    if (existing) renewHistoryIds(data, account);
    const creditSales = new Set(data.debts.map(row => row.checkoutID));
    const paidCreditSales = data.checkouts.filter(row => row.status === 'PAID' && creditSales.has(row.id!)).map(row => row.id!);
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
    await client.$transaction(
        async tx => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`seed:${shopID}`}))::text`;
            if (existing) {
                await clearGeneratedHistory(tx, account);
                const buckets = await tx.expense.findMany({ where: { tenantID, shopID }, select: { id: true, year: true, month: true } });
                for (const expense of data.expenses) {
                    const bucket = buckets.find(row => row.year === expense.year && row.month === expense.month);
                    if (!bucket) continue;
                    for (const item of data.expenseItems)
                        if (item.expenseID === expense.id) item.expenseID = bucket.id;
                    expense.id = bucket.id;
                }
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
                tx.inventory.createMany({ data: batch, skipDuplicates: true }),
            );
            await chunks(data.variants, batch =>
                tx.shopVariant.createMany({ data: batch, skipDuplicates: true }),
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
                tx.checkout.createMany({ data: batch.map(row => creditSales.has(row.id!) && row.status === 'PAID'
                    ? { ...row, status: 'UNPAID' } : row) }),
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
            // A paid credit sale must have its debt before the cash trigger sees PAID.
            await chunks(paidCreditSales, batch => tx.$executeRaw`
                UPDATE checkouts SET status = 'PAID'
                WHERE "tenantID" = ${tenantID} AND "shopID" = ${shopID} AND id IN (${Prisma.join(batch)})`);
            await chunks(data.ledger, batch =>
                tx.buyerDebtLedger.createMany({ data: batch }),
            );
            await chunks(data.expenses, batch =>
                tx.expense.createMany({ data: batch, skipDuplicates: true }),
            );
            await chunks(data.expenseItems, batch =>
                tx.expenseItem.createMany({ data: batch }),
            );
            const totals = await tx.expenseItem.groupBy({
                by: ['expenseID'], where: { tenantID, expense: { shopID } }, _sum: { amount: true },
            });
            await tx.expense.updateMany({ where: { tenantID, shopID }, data: { totalAmount: 0 } });
            for (const total of totals)
                await tx.expense.update({ where: { id: total.expenseID }, data: { totalAmount: Math.round((total._sum.amount ?? 0) * 100) / 100 } });
            const stock = await tx.lot.groupBy({
                by: ['shopVariantId'], where: { tenantID, shopVariantId: { in: data.variants.map(row => row.id!) }, ShopVariant: { shopID } }, _sum: { stock: true },
            });
            for (const row of stock)
                await tx.shopVariant.update({ where: { id: row.shopVariantId }, data: { totalProducts: row._sum.stock ?? 0 } });
        },
        { maxWait: 10000, timeout: 180000, isolationLevel: 'Serializable' },
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
        await seedAccount(account, now, refresh, prisma);
    console.log('Seed complete. New accounts use password: ' + SEED_PASSWORD);
}

if (require.main === module) {
    main()
        .catch(error => {
            console.error('Seed failed:', error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
