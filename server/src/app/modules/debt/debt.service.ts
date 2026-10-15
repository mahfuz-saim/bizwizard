import prisma from '../../../shared/prisma';
import {
    PaymentStatus,
    Prisma,
    DebtStatus,
    LedgerEntryType,
} from '@prisma/client';
import {
    IAddPreviousDebt,
    IGetUserDebt,
    IUpdateBulkDebt,
    IUpdateSingleDebt,
} from './debt.interface';
import { IPaginationOptions } from '../../../interfaces/pagination';
import { paginationHelpers } from '../../../helpers/paginationHelper';
import { ICreateCheckout } from '../checkout/checkout.interface';
import { checkoutService } from '../checkout/checkout.service';
import { JwtPayload } from '../../../interfaces/common';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';
import { smsHelper } from '../../../helpers/sendSMS';

const getBuyerCurrentBalance = async (
    shopId: string,
    buyerId: string,
    tenantId: string,
) => {
    const lastEntry = await prisma.buyerDebtLedger.findFirst({
        where: {
            shopId,
            buyerId,
            tenantID: tenantId,
        },
        orderBy: {
            createdAt: 'desc',
        },
        select: {
            newBalance: true,
        },
    });
    return lastEntry?.newBalance || 0;
};

const createLedgerEntry = async (
    tx: any,
    data: {
        shopId: string;
        buyerId: string;
        type: LedgerEntryType;
        amount: number;
        previousBalance: number;
        tenantId: string;
        debtId?: string;
        checkoutId?: string;
        description?: string;
        metadata?: any;
    },
) => {
    const newBalance =
        data.type === LedgerEntryType.DEBT_CREATED
            ? data.previousBalance + data.amount
            : data.previousBalance - data.amount;

    return await tx.buyerDebtLedger.create({
        data: {
            shopId: data.shopId,
            buyerId: data.buyerId,
            tenantID: data.tenantId,
            type: data.type,
            amount: data.amount,
            previousBalance: data.previousBalance,
            newBalance: Number(newBalance.toFixed(2)),
            debtId: data.debtId,
            checkoutId: data.checkoutId,
            description: data.description,
            metadata: data.metadata,
        },
    });
};

const notifyDebtPaymentBySms = async (
    payload: { msgBody: string; number: string },
    shopId: string,
    tenantId: string,
) => {
    const shop = await prisma.shop.findFirstOrThrow({
        where: {
            id: shopId,
            tenantID: tenantId,
        },
    });
    // check sms credit
    const totalSmsCredit = shop.credit || 0;
    const msgCost = 1; //credit cost per msg, TODO: make dynamic later
    if (totalSmsCredit < msgCost) {
        return {
            success: false,
            msg: 'Insufficient SMS credit. Please recharge to send notifications.',
        };
    }

    // send msg
    const result = await smsHelper.sendGeneralMessage({
        msgBody: payload.msgBody,
        number: `88${payload.number}`,
    });
    //check result, if not success adjust credit back
    if (!result?.success) {
        return {
            success: false,
            msg: 'Failed to send SMS notifications.',
        };
    }

    //update sms credit
    await prisma.shop.update({
        where: {
            id: shopId,
        },
        data: {
            credit: {
                decrement: 1,
            },
        },
    });

    //return status
    return {
        success: true,
        msg: 'SMS sent successfully',
    };
};

const getAllDebt = async (
    shopId: string,
    tenantId: string,
    filters: any,
    options: IPaginationOptions,
) => {
    const shop = await prisma.shop.findFirst({
        where: {
            id: shopId,
            tenantID: tenantId,
        },
    });

    if (!shop) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Shop Not Found');
    }

    const { limit, page, skip, sortOrder } =
        paginationHelpers.calculatePagination(options);

    const { searchTerm, date, includeCompleted, status } = filters;
    const andConditions: Prisma.DebtWhereInput[] = [
        {
            shopID: shopId,
            tenantID: tenantId,
        },
    ];

    // Status filter takes precedence over includeCompleted
    if (status) {
        andConditions.push({
            status: status as DebtStatus,
        });
    } else if (includeCompleted !== 'true') {
        // Exclude PAID debts by default unless includeCompleted is true
        andConditions.push({
            status: {
                not: DebtStatus.PAID,
            },
        });
    }

    if (searchTerm) {
        andConditions.push({
            OR: ['name', 'number', 'address'].map(field => ({
                buyer: {
                    Shops: {
                        some: {
                            shopID: shopId,
                            tenantID: tenantId,

                            [field]: {
                                contains: searchTerm,
                                mode: 'insensitive',
                            },
                        },
                    },
                },
            })),
        });
    }

    const modifiedDate = date ? `${date}T00:00:00.000Z` : undefined;

    if (modifiedDate) {
        andConditions.push({ createdAt: { gte: modifiedDate } });
    }

    const whereCondition: Prisma.DebtWhereInput = { AND: andConditions };

    const buyers = await prisma.debt.groupBy({
        by: ['buyerID'],
        where: whereCondition,
        _count: {
            id: true,
        },
        skip: skip,
        take: limit,
        orderBy: {
            _count: {
                id: sortOrder === 'asc' ? 'asc' : 'desc',
            },
        },
    });

    let result = [];
    for (const item of buyers) {
        const buyerDetails = await prisma.buyer.findUnique({
            where: {
                userID: item.buyerID,
            },
            include: {
                Shops: {
                    where: {
                        shopID: shopId,
                        tenantID: tenantId,
                    },
                },
            },
        });

        const debtWhereConditions: Prisma.DebtWhereInput = {
            buyerID: item.buyerID,
            shopID: shopId,
            tenantID: tenantId,
        };
        if (status) {
            debtWhereConditions.status = status as DebtStatus;
        } else if (includeCompleted !== 'true') {
            // Exclude PAID debts by default unless includeCompleted is true
            debtWhereConditions.status = {
                not: DebtStatus.PAID,
            };
        }

        const debtDetails = await prisma.debt.findMany({
            where: debtWhereConditions,
            include: {
                checkout: true,
                debtPayments: true,
            },
        });

        const buyerDebt = {
            buyer: buyerDetails,
            items: debtDetails,
        };
        result.push(buyerDebt);
    }

    const totalDebtItems = await prisma.debt.count({
        where: {
            shopID: shopId,
            tenantID: tenantId,
        },
    });

    const totalDebtCustomers = await prisma.debt.groupBy({
        by: ['buyerID'],
        where: {
            shopID: shopId,
            tenantID: tenantId,
        },
        _count: {
            id: true,
        },
    });

    const totalDetbAmount = await prisma.checkout.aggregate({
        where: {
            shopID: shopId,
            tenantID: tenantId,
            status: PaymentStatus.UNPAID,
            isDraft: false,
        },
        _sum: {
            totalPrice: true,
        },
    });

    const constTotalReceivedAmount = await prisma.debt.aggregate({
        where: {
            shopID: shopId,
            tenantID: tenantId,
            status: {
                not: DebtStatus.PAID,
            },
        },
        _sum: {
            paidAmount: true,
        },
    });

    const totalDebtDiff =
        (totalDetbAmount._sum.totalPrice ?? 0) -
        (constTotalReceivedAmount._sum.paidAmount ?? 0);

    return {
        meta: { total: totalDebtCustomers.length, page, limit },
        data: result,
        summary: {
            totalDebtItems,
            totalDebtCustomers: totalDebtCustomers.length,
            totalDebtAmount: totalDetbAmount._sum.totalPrice || 0,
            totalRemainingAmount: totalDebtDiff,
        },
    };
};

const getSingleDebt = async (debtId: string, tenantId: string) => {
    const result = await prisma.debt.findFirstOrThrow({
        where: {
            id: debtId,
            tenantID: tenantId,
        },
        include: {
            checkout: {
                include: {
                    items: true,
                },
            },
            debtPayments: true,
        },
    });
    return result;
};

const resolveSingleDebt = async (
    paylod: IUpdateSingleDebt,
    tenantId: string,
) => {
    const debt = await prisma.debt.findFirstOrThrow({
        where: {
            id: paylod.debtId,
            tenantID: tenantId,
            status: {
                not: DebtStatus.PAID,
            },
        },
        include: {
            checkout: true,
            buyer: true,
        },
    });

    let result = null;

    /**
     * |         | less paid   | correct paid |
     * |---------|-------------|--------------|
     * | Full    | err         | ok           |
     * | partial | log & check | log & check  |
     *
     * if full, amount is optional. so we can ignore amount in full payment
     */

    const paidAmount = debt.paidAmount || 0;
    const priceDiff = debt.checkout.totalPrice - paidAmount;
    const paymentAmount =
        paylod.type === 'FULL' || priceDiff <= paylod.amount
            ? priceDiff
            : paylod.amount;

    if (paylod.type === 'FULL' || priceDiff <= paylod.amount) {
        result = await prisma.$transaction(async tx => {
            const previousBalance = await getBuyerCurrentBalance(
                debt.shopID,
                debt.buyerID,
                tenantId,
            );

            const updatedDebt = await tx.debt.update({
                where: { id: paylod.debtId },
                data: {
                    status: DebtStatus.PAID,
                    paidAmount: debt.checkout.totalPrice,
                },
            });
            await tx.debtPayments.create({
                data: {
                    debtId: updatedDebt.id,
                    amount: priceDiff,
                },
            });
            const updateCheckout = await tx.checkout.update({
                where: {
                    id: updatedDebt.checkoutID,
                },
                data: {
                    status: PaymentStatus.PAID,
                },
            });

            // Create ledger entry
            await createLedgerEntry(tx, {
                shopId: debt.shopID,
                buyerId: debt.buyerID,
                type: LedgerEntryType.PAYMENT_SINGLE,
                amount: paymentAmount,
                previousBalance,
                tenantId,
                debtId: debt.id,
                checkoutId: debt.checkoutID,
                description: `Full payment for debt #${debt.id.slice(-8)}`,
            });

            return updateCheckout;
        });
    } else if (paylod.type === 'PARTIAL') {
        result = await prisma.$transaction(async tx => {
            const previousBalance = await getBuyerCurrentBalance(
                debt.shopID,
                debt.buyerID,
                tenantId,
            );

            const updatedDebt = await tx.debt.update({
                where: {
                    id: paylod.debtId,
                },
                data: {
                    status: DebtStatus.PARTIALLY_PAID,
                    paidAmount: paylod.amount + paidAmount,
                    debtPayments: {
                        create: {
                            amount: paylod.amount,
                        },
                    },
                },
            });

            // Create ledger entry
            await createLedgerEntry(tx, {
                shopId: debt.shopID,
                buyerId: debt.buyerID,
                type: LedgerEntryType.PAYMENT_SINGLE,
                amount: paymentAmount,
                previousBalance,
                tenantId,
                debtId: debt.id,
                checkoutId: debt.checkoutID,
                description: `Partial payment for debt #${debt.id.slice(-8)}`,
            });

            return updatedDebt;
        });
    }

    if (paylod.notifySms) {
        const remainingDebt = await prisma.checkout.aggregate({
            where: {
                shopID: debt.shopID,
                buyerID: debt.buyerID,
                tenantID: tenantId,
                status: PaymentStatus.UNPAID,
            },
            _sum: {
                totalPrice: true,
            },
        });
        const notifyResult = await notifyDebtPaymentBySms(
            {
                msgBody: `Your debt of amount ${debt.checkout.totalPrice.toFixed(2)} has been fully paid. Remaining ${remainingDebt._sum.totalPrice?.toFixed(2) ?? 0}. Thank you!`,
                number: debt.buyer.number,
            },
            debt.shopID,
            tenantId,
        );

        result = {
            ...result,
            smsNotificationSuccess: notifyResult.success,
            smsNotificationMessage: notifyResult.msg,
        };
    }

    return result;
};

const resolveBulkDebt = async (payload: IUpdateBulkDebt, tenantId: string) => {
    const scopedBuyer = await prisma.shopBuyer.findFirst({
        where: {
            shopID: payload.shopId,
            buyerID: payload.buyerId,
            tenantID: tenantId,
        },
    });

    if (!scopedBuyer) {
        throw new ApiError(
            httpStatus.NOT_FOUND,
            'Buyer not found in this shop',
        );
    }

    let result = await prisma.$transaction(async tx => {
        const previousBalance = await getBuyerCurrentBalance(
            payload.shopId,
            payload.buyerId,
            tenantId,
        );

        const allDebts = await tx.debt.findMany({
            where: {
                buyerID: payload.buyerId,
                shopID: payload.shopId,
                tenantID: tenantId,
                status: {
                    not: DebtStatus.PAID,
                },
            },
            include: {
                checkout: true,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
        let remainingBalance = payload.amount;
        const splitDetails: Array<{
            debtId: string;
            checkoutId: string;
            amount: number;
        }> = [];

        for (const debt of allDebts) {
            const debtDiff = debt.checkout.totalPrice - (debt.paidAmount || 0);
            if (debtDiff <= remainingBalance) {
                remainingBalance -= debtDiff;
                await tx.debt.update({
                    where: {
                        id: debt.id,
                    },
                    data: {
                        status: DebtStatus.PAID,
                        paidAmount: debt.checkout.totalPrice,
                        debtPayments: {
                            create: {
                                amount: debtDiff,
                            },
                        },
                    },
                });
                await tx.checkout.update({
                    where: {
                        id: debt.checkoutID,
                    },
                    data: {
                        status: PaymentStatus.PAID,
                    },
                });
                splitDetails.push({
                    debtId: debt.id,
                    checkoutId: debt.checkoutID,
                    amount: debtDiff,
                });
            } else if (remainingBalance > 0) {
                const newPaidAmount = Number(
                    ((debt.paidAmount || 0) + remainingBalance).toFixed(2),
                );
                await tx.debt.update({
                    where: {
                        id: debt.id,
                    },
                    data: {
                        status: DebtStatus.PARTIALLY_PAID,
                        paidAmount: newPaidAmount,
                        debtPayments: {
                            create: {
                                amount: remainingBalance,
                            },
                        },
                    },
                });
                splitDetails.push({
                    debtId: debt.id,
                    checkoutId: debt.checkoutID,
                    amount: remainingBalance,
                });
                remainingBalance = 0;
            }
        }

        // Create ledger entry for bulk payment
        await createLedgerEntry(tx, {
            shopId: payload.shopId,
            buyerId: payload.buyerId,
            type: LedgerEntryType.PAYMENT_BULK,
            amount: payload.amount,
            previousBalance,
            tenantId,
            description: `Bulk payment split across ${splitDetails.length} debt(s)`,
            metadata: { splitDetails },
        });

        return { remainingBalance };
    });

    if (payload.notifySms) {
        const user = await prisma.shopBuyer.findFirstOrThrow({
            where: {
                buyerID: payload.buyerId,
                shopID: payload.shopId,
                tenantID: tenantId,
            },
        });
        const remainingDebt = await prisma.checkout.aggregate({
            where: {
                shopID: payload.shopId,
                buyerID: payload.buyerId,
                tenantID: tenantId,
                status: PaymentStatus.UNPAID,
            },
            _sum: {
                totalPrice: true,
            },
        });
        const notifyResult = await notifyDebtPaymentBySms(
            {
                msgBody: `Your debt of amount ${payload.amount.toFixed(2)} has been paid. Remaining ${remainingDebt._sum.totalPrice?.toFixed(2) ?? 0}. Thank you!`,
                number: user.number,
            },
            payload.shopId,
            tenantId,
        );

        result = {
            ...result,
            smsNotificationSuccess: notifyResult.success,
            smsNotificationMessage: notifyResult.msg,
        } as any;
    }
    return result;
};

const getUserDebt = async (payload: IGetUserDebt, tenantId: string) => {
    const scopedBuyer = await prisma.shopBuyer.findFirst({
        where: {
            shopID: payload.shopId,
            buyerID: payload.buyerId,
            tenantID: tenantId,
        },
    });

    if (!scopedBuyer) {
        throw new ApiError(
            httpStatus.NOT_FOUND,
            'Buyer not found in this shop',
        );
    }

    const result = await prisma.debt.findMany({
        where: {
            buyerID: payload.buyerId,
            shopID: payload.shopId,
            tenantID: tenantId,
        },
    });
    return result;
};

const addPreviousDebt = async (
    payload: IAddPreviousDebt,
    user: JwtPayload,
    tenantId: string,
) => {
    const shop = await prisma.shop.findFirstOrThrow({
        where: {
            id: payload.shopId,
            tenantID: tenantId,
        },
        select: { tenantID: true },
    });

    const scopedBuyer = await prisma.shopBuyer.findFirst({
        where: {
            shopID: payload.shopId,
            buyerID: payload.buyerId,
            tenantID: tenantId,
        },
    });

    if (!scopedBuyer) {
        throw new ApiError(
            httpStatus.NOT_FOUND,
            'Buyer not found in this shop',
        );
    }

    const checkoutParams: ICreateCheckout = {
        shopID: payload.shopId,
        status: 'UNPAID',
        buyerID: payload.buyerId,
        paidAmount: payload.paidAmount,
        sendSMS: false,
        discountAmount: 0,
        discountPercentage: 0,
        discountType: 'AMOUNT',
        isDraft: false,
        items: [],
        customItems: [
            {
                name: 'Previous Debt',
                quantity: 1,
                unitPrice: payload.amount,
                discountAmount: 0,
                discountPercentage: 0,
                discountType: 'AMOUNT',
            },
        ],
    };
    const result = await checkoutService.createCheckout(
        checkoutParams,
        user,
        shop.tenantID,
    );
    return result;
};

const createDebtLedgerEntry = async (
    shopId: string,
    buyerId: string,
    debtId: string,
    checkoutId: string,
    amount: number,
    tenantId: string,
) => {
    await prisma.$transaction(async tx => {
        const previousBalance = await getBuyerCurrentBalance(
            shopId,
            buyerId,
            tenantId,
        );

        await createLedgerEntry(tx, {
            shopId,
            buyerId,
            type: LedgerEntryType.DEBT_CREATED,
            amount,
            previousBalance,
            tenantId,
            debtId,
            checkoutId,
            description: `Debt created from checkout #${checkoutId.slice(-8)}`,
        });
    });
};

const getBuyerLedger = async (
    shopId: string,
    buyerId: string,
    tenantId: string,
    options?: IPaginationOptions,
) => {
    const scopedBuyer = await prisma.shopBuyer.findFirst({
        where: {
            shopID: shopId,
            buyerID: buyerId,
            tenantID: tenantId,
        },
    });

    if (!scopedBuyer) {
        throw new ApiError(
            httpStatus.NOT_FOUND,
            'Buyer not found in this shop',
        );
    }

    const { limit, page, skip } = options
        ? paginationHelpers.calculatePagination(options)
        : { limit: 100, page: 1, skip: 0 };

    const ledger = await prisma.buyerDebtLedger.findMany({
        where: {
            shopId,
            buyerId,
            tenantID: tenantId,
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: limit,
        skip,
    });

    const total = await prisma.buyerDebtLedger.count({
        where: {
            shopId,
            buyerId,
            tenantID: tenantId,
        },
    });

    const buyer = await prisma.buyer.findUniqueOrThrow({
        where: {
            userID: buyerId,
        },
        select: {
            name: true,
            number: true,
            address: true,
        },
    });

    const currentBalance = await getBuyerCurrentBalance(
        shopId,
        buyerId,
        tenantId,
    );

    return {
        buyer,
        currentBalance,
        ledger: ledger.map(entry => ({
            id: entry.id,
            type: entry.type,
            amount: entry.amount,
            previousBalance: entry.previousBalance,
            newBalance: entry.newBalance,
            debtId: entry.debtId,
            checkoutId: entry.checkoutId,
            description: entry.description,
            metadata: entry.metadata,
            createdAt: entry.createdAt,
        })),
        meta: {
            total,
            page,
            limit,
        },
    };
};

export const debtService = {
    getAllDebt,
    getSingleDebt,
    resolveSingleDebt,
    resolveBulkDebt,
    getUserDebt,
    addPreviousDebt,
    createDebtLedgerEntry,
    getBuyerLedger,
};
