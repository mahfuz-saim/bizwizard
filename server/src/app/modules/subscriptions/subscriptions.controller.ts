import { NextFunction, Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { JwtPayload } from '../../../interfaces/common';
import { subscriptionService } from './subscriptions.service';

const getSubscriptionByShopId = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { shopId } = req.params;
        const tenantId = req.tenantId as string;
        const result = await subscriptionService.getSubscriptionByShopId(
            shopId,
            tenantId,
        );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Shop Subscription Retrieved Successfully',
            data: result,
        });
    },
);

const getAllSubscriptionPlans = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await subscriptionService.getAllSubscriptionPlans();

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'All Subscription Retrieved Successfully',
            data: result,
        });
    },
);

const addSubscriptionPlan = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await subscriptionService.addSubscriptionPlan(req.body);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'New Subscription Plan Create Successfully',
            data: result,
        });
    },
);

const addEmployeePlan = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await subscriptionService.addEmployeePlan(req.body);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'New Employee Add On Created Successfully',
            data: result,
        });
    },
);

const deletePlan = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await subscriptionService.deletePlan(req.body);

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: 'Plan Deleted Successfully',
            data: result,
        });
    },
);
export const subscriptionController = {
    getSubscriptionByShopId,
    getAllSubscriptionPlans,
    addSubscriptionPlan,
    addEmployeePlan,
    deletePlan,
};
