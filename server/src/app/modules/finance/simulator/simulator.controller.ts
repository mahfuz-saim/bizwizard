import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../../shared/catchAsync';
import sendResponse from '../../../../shared/sendResponse';
import { simulatorService } from './simulator.service';

const tenant = (req: Request) => req.tenantId as string;
const shop = (req: Request) => (req.query.shopId ?? req.body?.shopId) as string;

export const simulatorController = {
  fastForward: catchAsync(async (req: Request, res: Response) => {
    const result = await simulatorService.fastForward(tenant(req), req.body.shopId, req.body.template);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: `Simulated ${result.dailyEvents.length} days of business activity into the live shop ledger`,
      data: result,
    });
  }),
  inspect: catchAsync(async (req: Request, res: Response) => {
    const result = await simulatorService.inspect(tenant(req), shop(req), req.query.type as string, req.query.id as string);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Underlying record retrieved', data: result });
  }),
  reset: catchAsync(async (req: Request, res: Response) => {
    const result = await simulatorService.reset(tenant(req), req.body.shopId);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Simulated data cleared', data: result });
  }),
};
