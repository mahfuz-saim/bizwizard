import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import pick from '../../../shared/pick';
import { paginationFields } from '../../../const';
import { salesRepresentativeService } from './saleRepresentative.service';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { IUploadFile } from '../../../interfaces/file';

const getAllSalesRepresentatives = catchAsync(
    async (req: Request, res: Response) => {
        const tenantId = req.tenantId as string;
        const filters = pick(req.query, [
            'name',
            'number',
            'ReferralCode',
            'searchTerm',
        ]);
        const options = pick(req.query, paginationFields);

        const result =
            await salesRepresentativeService.getAllSalesRepresentatives(
                filters,
                options,
                tenantId,
            );

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: 'Sales representatives retrieved successfully',
            meta: result.meta,
            data: result.data,
        });
    },
);

const getSalesRepresentativeByID = catchAsync(async (req, res) => {
    const tenantId = req.tenantId as string;
    const { id } = req.params;
    const result = await salesRepresentativeService.getSalesRepresentativeByID(
        id,
        tenantId,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Sales representative found successfully',
        data: result,
    });
});

const getSalesRepresentativeByReferralCode = catchAsync(async (req, res) => {
    const tenantId = req.tenantId as string;
    const { referralCode } = req.params;
    const result =
        await salesRepresentativeService.getSalesRepresentativeByReferralCode(
            referralCode,
            tenantId,
        );

    sendResponse(res, {
        statusCode: result ? httpStatus.OK : httpStatus.NOT_FOUND,
        success: !!result,
        message: result
            ? 'Sales representative found successfully'
            : 'No sales representative found with this referral code',
        data: result,
    });
});

const deleteSalesRepresentative = catchAsync(async (req, res) => {
    const tenantId = req.tenantId as string;
    const { id } = req.params;
    const result = await salesRepresentativeService.deleteSalesRepresentative(
        id,
        tenantId,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Sales representative deleted successfully',
        data: result,
    });
});

const updateSalesRepresentative = catchAsync(async (req, res) => {
    const tenantId = req.tenantId as string;
    const { id } = req.params;
    const file = req.file as IUploadFile;
    const result = await salesRepresentativeService.updateSalesRepresentative(
        id,
        req.body,
        file,
        tenantId,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Sales representative updated successfully',
        data: result,
    });
});

export const salesRepresentativeController = {
    getAllSalesRepresentatives,
    getSalesRepresentativeByID,
    getSalesRepresentativeByReferralCode,
    deleteSalesRepresentative,
    updateSalesRepresentative,
};
