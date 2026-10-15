import { ExpenseType } from '@prisma/client';
import { z } from 'zod';

// Schema for creating an expense
const createExpense = z.object({
    body: z.object({
        shopID: z.string({
            required_error: 'Shop ID is required',
        }),
        month: z.number().int().min(1).max(12).optional(),
        year: z.number().int().optional(),
        items: z
            .array(
                z.object({
                    amount: z.number({
                        required_error: 'Item amount is required',
                    }),
                    name: z.string().optional(),
                    description: z.string().optional(),
                    expenseType: z.nativeEnum(ExpenseType).optional(),
                }),
            )
            .nonempty({
                message: 'At least one expense item is required',
            }),
    }).refine(
        data =>
            (data.month === undefined && data.year === undefined) ||
            (data.month !== undefined && data.year !== undefined),
        {
            message: 'Month and year must be provided together',
        },
    ),
});

// Schema for updating an expense
const updateExpense = z.object({
    body: z.object({
        month: z.number().int().min(1).max(12).optional(),
        year: z.number().int().optional(),
        items: z
            .array(
                z.object({
                    id: z.string().optional(), // Optional for new items, required for updating existing ones
                    amount: z.number({
                        required_error: 'Item amount is required',
                    }),
                    name: z.string().optional(),
                    description: z.string().optional(),
                    expenseType: z.nativeEnum(ExpenseType).optional(),
                }),
            )
            .optional(),
    }).refine(
        data =>
            (data.month === undefined && data.year === undefined) ||
            (data.month !== undefined && data.year !== undefined),
        {
            message: 'Month and year must be provided together',
        },
    ),
});

export const expenseZodSchema = {
    createExpense,
    updateExpense,
};
