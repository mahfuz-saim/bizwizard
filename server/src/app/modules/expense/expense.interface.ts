import { ExpenseType } from '@prisma/client';

// Interfaces
export interface IExpenseFilters {
    searchTerm?: string;
    month?: number;
    year?: number;
    expenseType?: ExpenseType;
}

export interface ICreateExpense {
    shopID: string;
    month?: number;
    year?: number;
    items: {
        amount: number;
        name?: string;
        description?: string;
        expenseType?: ExpenseType;
    }[];
}

export interface IUpdateExpense {
    month?: number;
    year?: number;
    items?: {
        id?: string; // Existing item ID if updating
        amount: number;
        name?: string;
        description?: string;
        expenseType?: ExpenseType;
    }[];
}
