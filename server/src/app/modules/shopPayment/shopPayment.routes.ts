import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { paymentValidationSchema } from './shopPayment.validation';
import { paymentController } from './shopPayment.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();

router.post(
    '/init',
    auth(UserRole.OWNER),
    verifyTenantAccess,
    validateRequest(paymentValidationSchema.paymentSchema),
    paymentController.initPayment,
);

router.post(
    '/ipn',
    validateRequest(paymentValidationSchema.IPNSchema),
    paymentController.postIPN,
);

//TEST ROUTES
router.post('/success', (req, res) => {
    res.send(req.body);
});

router.post('/fail', (req, res) => {
    res.send(req.body);
});

router.post('/cancel', (req, res) => {
    res.send(req.body);
});

export const shopPaymentRoutes = router;

//PAYMENT PROCESS
//1. initiate payment by calling /init endpoint with payment details
//2. init will redirect user to payment gateway
//3. after payment, gateway will call /ipn endpoint with payment details
//4. /ipn will process the payment and return success or failure. Or redirect user to success or failure page
//5. user can check payment status by calling /validate endpoint with validationId
//
//TODO:
//[x] 1. generate unique tran_id for each payment -> use nanoId
//[x] 2. set ipn_url in env
//[x] 3. pass fixed data in paymentSchema
//
//4. store payment details in db in /init
//5. implement postIPN to handle payment success/failure -> update db
//6. implement validatePayment to check payment status
