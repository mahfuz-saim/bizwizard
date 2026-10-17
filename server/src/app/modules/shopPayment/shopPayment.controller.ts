import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { JwtPayload } from '../../../interfaces/common';
import { paymentService } from './shopPayment.service';

const initPayment = catchAsync(async (req, res) => {
    const tenantId = req.tenantId as string;
    const result = await paymentService.initPayment(
        req.body,
        req.user as JwtPayload,
        tenantId,
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Demo payment completed successfully',
        data: result,
    });
});

export const paymentController = { initPayment };
