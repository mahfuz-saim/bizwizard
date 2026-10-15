import express from 'express';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { couponController } from './coupon.controller';
import { couponValidation } from './coupon.validation';

const router = express.Router();

router.get('/verify/:couponCode', couponController.verifyCoupon);

router.get('/', auth(UserRole.ADMIN), couponController.getAllCoupon);

router.post(
    '/',
    auth(UserRole.ADMIN),
    validateRequest(couponValidation.createCouponSchema),
    couponController.createCoupon,
);

router.put(
    '/:couponId',
    auth(UserRole.ADMIN),
    validateRequest(couponValidation.UpdateCouponSchema),
    couponController.updateCoupon,
);
router.delete('/:couponId', couponController.deleteCoupon);

export const couponRoutes = router;
