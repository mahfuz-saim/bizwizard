import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { AuthUtils } from '../src/helpers/bcryptHelpers';
import {
    buildTransactionData,
    SEED_PASSWORD,
    seedAccounts,
    seedId,
    SeedAccount,
} from './seed/transaction-data';

const prisma = new PrismaClient();

async function seedAccount(account: SeedAccount, now: Date) {
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
        console.log(
            `${account.email}: already seeded; keeping existing data and password.`,
        );
        return;
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
                data: { shopID, tenantID, createdAt: start, updatedAt: start },
            });
            await chunks(data.users, batch =>
                tx.user.createMany({ data: batch }),
            );
            await chunks(data.buyers, batch =>
                tx.buyer.createMany({ data: batch }),
            );
            await chunks(data.shopBuyers, batch =>
                tx.shopBuyer.createMany({ data: batch }),
            );
            await chunks(data.suppliers, batch =>
                tx.supplier.createMany({ data: batch }),
            );
            await chunks(data.shopSuppliers, batch =>
                tx.shopSupplier.createMany({ data: batch }),
            );
            await chunks(data.inventory, batch =>
                tx.inventory.createMany({ data: batch }),
            );
            await chunks(data.variants, batch =>
                tx.shopVariant.createMany({ data: batch }),
            );
            await chunks(data.lots, batch =>
                tx.lot.createMany({ data: batch }),
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
        `${account.email}: ${data.inventory.length} products, ${data.buyers.length} customers, ${data.checkouts.length} sales, ${data.lots.length} purchases, ${data.debts.length} credit sales, ${data.expenses.length} expense months (${start.toISOString()} – ${now.toISOString()}).`,
    );
}

async function main() {
    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            'Development seed accounts have public passwords. Refusing to seed in production.',
        );
    }
    if (!process.env.DATABASE_URL)
        throw new Error(
            'Set DATABASE_URL in server/.env before running npm run seed.',
        );
    const now = new Date();
    for (const account of seedAccounts) await seedAccount(account, now);
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
