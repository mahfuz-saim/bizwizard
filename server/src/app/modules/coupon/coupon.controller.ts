import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { JwtPayload } from '../../../interfaces/common';
import { couponService } from './coupon.service';

const getAllCoupon = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await couponService.getAllCoupon();

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'ALl Coupon Retrieved Successfully!',
            data: result,
        });
    },
);

const createCoupon = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await couponService.createCoupon(req.body);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Coupon created Successfully!',
            data: result,
        });
    },
);

const verifyCoupon = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { couponCode } = req.params;
        const result = await couponService.verifyCoupon(couponCode);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Coupon veriied Successfully!',
            data: result,
        });
    },
);

const updateCoupon = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { couponId } = req.params;
        const result = await couponService.updateCoupon(couponId, req.body);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Coupon updated Successfully!',
            data: result,
        });
    },
);

const deleteCoupon = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { couponId } = req.params;
        const result = await couponService.deleteCoupon(couponId);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Coupon deleted Successfully!',
            data: result,
        });
    },
);

export const couponController = {
    getAllCoupon,
    createCoupon,
    verifyCoupon,
    updateCoupon,
    deleteCoupon,
};
