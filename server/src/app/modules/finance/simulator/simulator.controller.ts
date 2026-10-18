import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../../shared/catchAsync';
import sendResponse from '../../../../shared/sendResponse';
import { simulatorService } from './simulator.service';

const tenant = (req: Request) => req.tenantId as string;
const shop = (req: Request) => (req.query.shopId ?? req.body?.shopId) as string;

export const simulatorController = {
  prepare: catchAsync(async (req: Request, res: Response) => {
    const data = await simulatorService.prepare(tenant(req), req.body.shopId);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Isolated demo workspace ready', data });
  }),
  workspace: catchAsync(async (req: Request, res: Response) => {
    const data = await simulatorService.workspace(tenant(req), shop(req));
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Demo workspace retrieved', data });
  }),
  fastForward: catchAsync(async (req: Request, res: Response) => {
    const result = await simulatorService.fastForward(tenant(req), req.body.shopId, req.body.template);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: `Simulated ${result.dailyEvents.length} days in the isolated demo ledger; source shop unchanged`,
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
