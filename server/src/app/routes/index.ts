import express from 'express';
import { userRoutes } from '../modules/user/user.routes';
import { AuthRoutes } from '../modules/auth/auth.routes';
import { adminRouters } from '../modules/admin/admin.routes';
import { ownerRouters } from '../modules/owner/owner.routes';
import { shopRoutes } from '../modules/shop/shop.routes';
import { inventoryRoutes } from '../modules/inventory/inventory.routes';
import { productRoutes } from '../modules/product/product.routes';
import { checkoutRoutes } from '../modules/checkout/checkout.routes';
import { buyerRoutes } from '../modules/buyer/buyer.routes';
import { pickupRoutes } from '../modules/pickup/pickup.routes';
import { employeeRoutes } from '../modules/employee/employee.routes';
import { salesRepresentativeRoutes } from '../modules/saleRepresentative/saleRepresentative.routes';
import { shopPaymentRoutes } from '../modules/shopPayment/shopPayment.routes';
import { auditRoutes } from '../modules/auditLog/auditLog.routes';
import { noteRoutes } from '../modules/note/note.routes';
import { expenseRoutes } from '../modules/expense/expense.routes';
import { draftOrderRoutes } from '../modules/draftOrder/draftOrder.routes';
import { debtRoutes } from '../modules/debt/debt.routes';
import { creditRoutes } from '../modules/credit/credit.routes';
import { supplierRoutes } from '../modules/supplier/supplier.routes';
import { appVersionRoutes } from '../modules/appVersion/appVersion.routes';
import { analyticsRoutes } from '../modules/analytics/analytics.routes';
import { subscriptionRoutes } from '../modules/subscriptions/subscriptions.routes';
import { notificationRoutes } from '../modules/notification/notification.routes';
import { couponRoutes } from '../modules/coupon/coupon.routes';
import { referralRouters } from '../modules/referral/referral.routes';
import { matchingRoutes } from '../modules/finance/matching/matching.routes';
import { cashflowRoutes } from '../modules/finance/cashflow/cashflow.routes';
import { analysisRoutes } from '../modules/finance/analysis/analysis.routes';
import { agentsRoutes } from '../modules/finance/agents/agents.routes';

const router = express.Router();

const moduleRoutes = [
    {
        path: '/auth',
        route: AuthRoutes,
    },
    {
        path: '/user',
        route: userRoutes,
    },
    {
        path: '/admin',
        route: adminRouters,
    },
    {
        path: '/owner',
        route: ownerRouters,
    },
    {
        path: '/shop/payment',
        route: shopPaymentRoutes,
    },
    {
        path: '/shop',
        route: shopRoutes,
    },
    {
        path: '/inventory',
        route: inventoryRoutes,
    },
    {
        path: '/product',
        route: productRoutes,
    },
    {
        path: '/checkout',
        route: checkoutRoutes,
    },
    {
        path: '/buyer',
        route: buyerRoutes,
    },
    {
        path: '/pickup',
        route: pickupRoutes,
    },
    {
        path: '/employee',
        route: employeeRoutes,
    },
    {
        path: '/sale',
        route: salesRepresentativeRoutes,
    },
    {
        path: '/audit-log',
        route: auditRoutes,
    },
    {
        path: '/note',
        route: noteRoutes,
    },
    {
        path: '/expense',
        route: expenseRoutes,
    },
    {
        path: '/draft-order',
        route: draftOrderRoutes,
    },
    {
        path: '/debt',
        route: debtRoutes,
    },
    {
        path: '/credit',
        route: creditRoutes,
    },

    {
        path: '/supplier',
        route: supplierRoutes,
    },
    {
        path: '/app-version',
        route: appVersionRoutes,
    },

    {
        path: '/analytics',
        route: analyticsRoutes,
    },
    {
        path: '/subscription',
        route: subscriptionRoutes,
    },
    {
        path: '/notifications',
        route: notificationRoutes,
    },
    {
        path: '/coupon',
        route: couponRoutes,
    },
    {
        path: '/referral',
        route: referralRouters,
    },
    {
        path: '/finance/matching',
        route: matchingRoutes,
    },
    {
        path: '/finance/cashflow',
        route: cashflowRoutes,
    },
    {
        path: '/finance/analysis',
        route: analysisRoutes,
    },
    {
        path: '/finance/agents',
        route: agentsRoutes,
    },
];

moduleRoutes.forEach(route => router.use(route.path, route.route));
export default router;
