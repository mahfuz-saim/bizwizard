import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { paymentValidationSchema } from './shopPayment.validation';
import { paymentController } from './shopPayment.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();

// Demo checkout: validates the purchase and applies it immediately.
// There is no external payment gateway or IPN callback anymore.
router.post(
    '/init',
    auth(UserRole.OWNER),
    verifyTenantAccess,
    validateRequest(paymentValidationSchema.paymentSchema),
    paymentController.initPayment,
);

export const shopPaymentRoutes = router;

//PAYMENT PROCESS
//1. initiate a purchase by calling /init with payment details
//2. the server records a ShopPayment row and applies the plan/credit immediately
//3. the response is the caller's success_url with tran_id and status=VALID
//4. set PAYMENT_MODE=demo (default) in the server environment
