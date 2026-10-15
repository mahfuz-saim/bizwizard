import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../../shared/prisma';

export type SalesRepCreditTx = Prisma.TransactionClient | PrismaClient;

/**
 * Upsert the SR's wallet and append a credit topup. Runs the wallet
 * totalCredits increment and the topup insert in a single transaction
 * supplied by the caller so the caller can wrap multiple writes atomically.
 */
const upsertWalletAndAppendTopup = async (
    tx: SalesRepCreditTx,
    params: {
        salesRepId: string;
        credits: number;
        reason?: string;
        refId?: string;
    },
) => {
    const { salesRepId, credits, reason, refId } = params;

    const wallet = await tx.salesRepCreditWallet.upsert({
        where: { salesRepId },
        update: {
            totalCredits: { increment: credits },
        },
        create: {
            salesRepId,
            totalCredits: credits,
            usedCredits: 0,
        },
    });

    await tx.salesRepCreditTopup.create({
        data: {
            salesRepId,
            walletId: wallet.id,
            credits,
            reason: reason ?? null,
            refId: refId ?? null,
        },
    });

    return wallet;
};

/**
 * Read-only helper: fetch the wallet balance + recent topups for an SR.
 */
const getWalletForSalesRep = async (salesRepId: string) => {
    const wallet = await prisma.salesRepCreditWallet.findUnique({
        where: { salesRepId },
    });

    if (!wallet) {
        return {
            wallet: null,
            topups: [],
        };
    }

    const topups = await prisma.salesRepCreditTopup.findMany({
        where: { walletId: wallet.id },
        orderBy: { addedAt: 'desc' },
    });

    return { wallet, topups };
};

export const salesRepCreditService = {
    upsertWalletAndAppendTopup,
    getWalletForSalesRep,
};