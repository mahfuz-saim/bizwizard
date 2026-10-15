import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { PickupService } from './pickup.service';
import { JwtPayload } from '../../../interfaces/common';
import pick from '../../../shared/pick';
import { paginationFields } from '../../../const';
import ApiError from '../../../errors/ApiError';
import { Request } from 'express';

const getTenantIdFromRequest = (req: Request) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Tenant context is missing');
    }

    return tenantId;
};

const createPickup = catchAsync(async (req, res) => {
    const tenantId = getTenantIdFromRequest(req);
    const result = await PickupService.createPickup(
        req.body,
        req.user as JwtPayload,
        tenantId,
    );
    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'Pickup is created successfully',
        data: result,
    });
});

const getAllPickup = catchAsync(async (req, res) => {
    const tenantId = getTenantIdFromRequest(req);
    const filters = pick(req.query, [
        'status',
        'paymentStatus',
        'searchTerm',
        'date',
    ]);
    const options = pick(req.query, paginationFields);

    const result = await PickupService.getAllPickup(
        filters,
        options,
        req.user as JwtPayload,
        tenantId,
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Pickup retrieval successfully',
        data: result,
    });
});

const getSinglePickup = catchAsync(async (req, res) => {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = req.params;

    const result = await PickupService.getSinglePickup(
        id,
        req.user as JwtPayload,
        tenantId,
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Pickup retrieval successfully',
        data: result,
    });
});

const updatePickup = catchAsync(async (req, res) => {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = req.params;
    const result = await PickupService.updatePickup(id, req.body, tenantId);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Pickup is updated successfully',
        data: result,
    });
});

const deletePickup = catchAsync(async (req, res) => {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = req.params;
    const result = await PickupService.deletePickup(id, tenantId);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Pickup is delete successfully',
        data: result,
    });
});

export const pickupController = {
    createPickup,
    getAllPickup,
    updatePickup,
    getSinglePickup,
    deletePickup,
};
