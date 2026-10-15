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
        message: 'Payment initialized successfully',
        data: result,
    });

    //TODO: redirect after testing
    //res.redirect(result);
});

const postIPN = catchAsync(async (req, res) => {
    let ipnData = req.body;
    ipnData.tran_date = new Date(ipnData.tran_date);
    ipnData.amount = Number(ipnData.amount);
    ipnData.store_amount = Number(ipnData.store_amount);

    const result = await paymentService.postIPN(ipnData);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'IPN Received successfully',
        data: result,
    });
});

export const paymentController = { initPayment, postIPN };
