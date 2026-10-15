import express from 'express';
import { expenseController } from './expense.controller';
import validateRequest from '../../middlewares/validateRequest';
import { expenseZodSchema } from './expense.validation';
import auth from '../../middlewares/auth';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';
import { UserRole } from '@prisma/client';

const router = express.Router();

// Create expense - only ADMIN, SUPER_ADMIN, and OWNER can create expenses
router.post(
    '/',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    validateRequest(expenseZodSchema.createExpense),
    expenseController.createExpense,
);

// Get expenses for a shop - ADMIN, SUPER_ADMIN, and OWNER can view expenses
router.get(
    '/shop/:shopID',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    expenseController.getExpenses,
);

// Get expense by ID - ADMIN, SUPER_ADMIN, and OWNER can view specific expense
router.get(
    '/:id',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    expenseController.getExpenseById,
);

// Update expense - ADMIN, SUPER_ADMIN, and OWNER can update expenses
router.patch(
    '/:id',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    validateRequest(expenseZodSchema.updateExpense),
    expenseController.updateExpense,
);

// Delete expense - only ADMIN and SUPER_ADMIN can delete expenses
router.delete(
    '/:id',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    expenseController.deleteExpense,
);

// Delete expense item - ADMIN, SUPER_ADMIN, and OWNER can delete expense items
router.delete(
    '/item/:itemId',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    expenseController.deleteExpenseItem,
);

export const expenseRoutes = router;
