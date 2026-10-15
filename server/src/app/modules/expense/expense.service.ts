import { Expense, ExpenseItem, ExpenseType, Prisma } from '@prisma/client';
import { JwtPayload } from '../../../interfaces/common';
import { IPaginationOptions } from '../../../interfaces/pagination';
import prisma from '../../../shared/prisma';
import { paginationHelpers } from '../../../helpers/paginationHelper';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';
import {
    ICreateExpense,
    IExpenseFilters,
    IUpdateExpense,
} from './expense.interface';

const createExpense = async (
    payload: ICreateExpense,
    tenantId: string,
    user: JwtPayload,
): Promise<Expense> => {
    const now = new Date();
    const month = payload.month ?? now.getMonth() + 1;
    const year = payload.year ?? now.getFullYear();

    const calculatedTotalAmount = payload.items.reduce(
        (total, item) => total + item.amount,
        0,
    );
    const totalAmount = calculatedTotalAmount;
    // Create expense and expense items in a transaction
    return await prisma.$transaction(async tx => {
        // Verify shop exists and user has access
        const shop = await tx.shop.findFirst({
            where: {
                id: payload.shopID,
                tenantID: tenantId,
            },
        });

        if (!shop) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
        }

        const existingExpense = await tx.expense.findFirst({
            where: {
                shopID: payload.shopID,
                tenantID: tenantId,
                month,
                year,
            },
        });

        if (existingExpense) {
            return await tx.expense.update({
                where: { id: existingExpense.id },
                data: {
                    totalAmount: { increment: totalAmount },
                    ExpenseItem: {
                        create: payload.items.map(item => ({
                            tenantID: tenantId,
                            amount: item.amount,
                            name: item.name,
                            description: item.description,
                            expenseType:
                                item.expenseType ?? ExpenseType.GENERAL,
                        })),
                    },
                },
                include: {
                    ExpenseItem: true,
                    shop: true,
                },
            });
        }

        return await tx.expense.create({
            data: {
                shopID: payload.shopID,
                tenantID: tenantId,
                totalAmount,
                month,
                year,
                ExpenseItem: {
                    create: payload.items.map(item => ({
                        tenantID: tenantId,
                        amount: item.amount,
                        name: item.name,
                        description: item.description,
                        expenseType: item.expenseType ?? ExpenseType.GENERAL,
                    })),
                },
            },
            include: {
                ExpenseItem: true,
                shop: true,
            },
        });
    });
};

const getExpenses = async (
    shopID: string,
    tenantId: string,
    filters: IExpenseFilters,
    options: IPaginationOptions,
    user: JwtPayload,
) => {
    const { searchTerm, month, year, expenseType } = filters;
    const { limit, page, skip, sortBy, sortOrder } =
        paginationHelpers.calculatePagination(options);

    // Build filter conditions
    const andConditions: Prisma.ExpenseWhereInput[] = [
        { shopID, tenantID: tenantId },
    ];

    const shop = await prisma.shop.findFirst({
        where: {
            id: shopID,
            tenantID: tenantId,
        },
    });

    if (!shop) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
    }

    // Apply search filters
    if (searchTerm) {
        andConditions.push({
            OR: [
                {
                    ExpenseItem: {
                        some: {
                            name: {
                                contains: searchTerm,
                                mode: 'insensitive',
                            },
                        },
                    },
                },
                {
                    ExpenseItem: {
                        some: {
                            description: {
                                contains: searchTerm,
                                mode: 'insensitive',
                            },
                        },
                    },
                },
            ],
        });
    }

    // Filter by expense type
    if (expenseType) {
        andConditions.push({
            ExpenseItem: {
                some: {
                    expenseType: expenseType as ExpenseType,
                },
            },
        });
    }

    // Filter by month-year
    const normalizedMonth = month !== undefined ? Number(month) : undefined;
    const normalizedYear = year !== undefined ? Number(year) : undefined;

    if (normalizedMonth !== undefined && normalizedYear !== undefined) {
        andConditions.push({
            month: normalizedMonth,
            year: normalizedYear,
        });
    }

    // Combine all conditions
    const whereConditions: Prisma.ExpenseWhereInput = { AND: andConditions };

    // Get total count
    const total = await prisma.expense.count({
        where: whereConditions,
    });
    // Get expenses with pagination
    const expenses = await prisma.expense.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy:
            sortBy && sortOrder
                ? { [sortBy]: sortOrder }
                : { createdAt: 'desc' },
        include: {
            ExpenseItem: {
        where:{
          expenseType: expenseType ? (expenseType as ExpenseType) : undefined, 
        }
      },
            shop: {
                select: {
                    id: true,
                    shopName: true,
                },
            },
        },
    });

    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        data: expenses,
    };
};

const getExpenseById = async (
    id: string,
    tenantId: string,
    user: JwtPayload,
) => {
    const expense = await prisma.expense.findFirst({
        where: {
            id,
            tenantID: tenantId,
        },
        include: {
            ExpenseItem: true,
            shop: {
                select: {
                    id: true,
                    shopName: true,
                    ownerID: true,
                },
            },
        },
    });

    if (!expense) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Expense not found');
    }

    return expense;
};

const updateExpense = async (
    id: string,
    payload: IUpdateExpense,
    tenantId: string,
    user: JwtPayload,
): Promise<Expense> => {
    return await prisma.$transaction(async tx => {
        const existingExpense = await tx.expense.findFirst({
            where: {
                id,
                tenantID: tenantId,
            },
            include: {
                shop: true,
                ExpenseItem: true,
            },
        });

        if (!existingExpense) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Expense not found');
        }

        if (payload.items && payload.items.length > 0) {
            const existingItemIds = existingExpense.ExpenseItem.map(
                item => item.id,
            );

            const updatedItemIds = payload.items
                .filter(item => item.id)
                .map(item => item.id as string);

            const invalidItemIds = updatedItemIds.filter(
                itemId => !existingItemIds.includes(itemId),
            );

            if (invalidItemIds.length > 0) {
                throw new ApiError(
                    httpStatus.BAD_REQUEST,
                    'Invalid expense item for this expense',
                );
            }

            for (const item of payload.items) {
                if (item.id) {
                    await tx.expenseItem.updateMany({
                        where: {
                            id: item.id,
                            expenseID: id,
                            tenantID: tenantId,
                        },
                        data: {
                            amount: item.amount,
                            name: item.name,
                            description: item.description,
                            expenseType:
                                item.expenseType ?? ExpenseType.GENERAL,
                        },
                    });
                } else {
                    await tx.expenseItem.create({
                        data: {
                            expenseID: id,
                            tenantID: tenantId,
                            amount: item.amount,
                            name: item.name,
                            description: item.description,
                            expenseType:
                                item.expenseType ?? ExpenseType.GENERAL,
                        },
                    });
                }
            }
        }

        const summedTotal = await tx.expenseItem.aggregate({
            where: {
                expenseID: id,
                tenantID: tenantId,
            },
            _sum: {
                amount: true,
            },
        });

        const resolvedTotalAmount = summedTotal._sum.amount ?? 0;

        return await tx.expense.update({
            where: { id },
            data: {
                totalAmount: resolvedTotalAmount,
                month: payload.month,
                year: payload.year,
            },
            include: {
                ExpenseItem: true,
                shop: true,
            },
        });
    });
};

const deleteExpense = async (
    id: string,
    tenantId: string,
    user: JwtPayload,
): Promise<Expense> => {
    // Verify expense exists and user has access
    const existingExpense = await prisma.expense.findFirst({
        where: {
            id,
            tenantID: tenantId,
        },
        include: {
            shop: true,
        },
    });

    if (!existingExpense) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Expense not found');
    }

    // Delete expense and related items in a transaction
    return await prisma.$transaction(async tx => {
        // Delete all expense items first
        await tx.expenseItem.deleteMany({
            where: {
                expenseID: id,
                tenantID: tenantId,
            },
        });

        // Delete the expense
        const deletedExpense = await tx.expense.delete({
            where: { id },
            include: {
                shop: true,
            },
        });

        return deletedExpense;
    });
};

const deleteExpenseItem = async (
    itemId: string,
    tenantId: string,
): Promise<Expense> => {
    const expenseItem = await prisma.expenseItem.findFirst({
        where: {
            id: itemId,
            tenantID: tenantId,
        },
    });

    if (!expenseItem) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Expense item not found');
    }

    return await prisma.$transaction(async tx => {
        await tx.expenseItem.delete({
            where: {
                id: itemId,
            },
        });

        const updatedExpense = await tx.expense.update({
            where: { id: expenseItem.expenseID },
            data: {
                totalAmount: { decrement: expenseItem.amount },
            },
            include: {
                ExpenseItem: true,
                shop: true,
            },
        });

        return updatedExpense;
    });
};

export const ExpenseService = {
    createExpense,
    getExpenses,
    getExpenseById,
    updateExpense,
    deleteExpense,
    deleteExpenseItem,
};
