import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../../shared/catchAsync';
import sendResponse from '../../../../shared/sendResponse';
import { matchingService } from './matching.service';

const tenant = (req: Request) => req.tenantId as string;
const shop = (req: Request) => (req.query.shopId ?? req.body?.shopId) as string;

export const matchingController = {
  getProfile: catchAsync(async (req: Request, res: Response) => {
    const result = await matchingService.getProfile(tenant(req), shop(req), Number(req.query.days ?? 90));
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Financial profile computed', data: result });
  }),
  listProviders: catchAsync(async (req: Request, res: Response) => {
    const result = await matchingService.listProviders(tenant(req));
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Providers retrieved', data: result });
  }),
  createMarket: catchAsync(async (req: Request, res: Response) => {
    const result = await matchingService.createMarket(tenant(req), req.body.shopId, req.body);
    sendResponse(res, { success: true, statusCode: httpStatus.CREATED, message: 'Market created', data: result });
  }),
  runMatching: catchAsync(async (req: Request, res: Response) => {
    const result = await matchingService.runMatching(tenant(req), req.body.shopId, req.body);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: result.insufficientData ? 'Insufficient data for matching' : 'Matching complete', data: result });
  }),
  getResults: catchAsync(async (req: Request, res: Response) => {
    const result = await matchingService.getResults(tenant(req), shop(req));
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Matching results retrieved', data: result });
  }),
  negotiate: catchAsync(async (req: Request, res: Response) => {
    const result = await matchingService.negotiate(tenant(req), shop(req), req.params.id);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Negotiation advanced', data: result });
  }),
  accept: catchAsync(async (req: Request, res: Response) => {
    const result = await matchingService.acceptOffer(tenant(req), shop(req), req.params.id, req.body);
    sendResponse(res, { success: true, statusCode: httpStatus.CREATED, message: 'Offer accepted — application and schedule created', data: result });
  }),
  reject: catchAsync(async (req: Request, res: Response) => {
    const result = await matchingService.rejectOffer(tenant(req), shop(req), req.params.id);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Offer rejected', data: result });
  }),
  listApplications: catchAsync(async (req: Request, res: Response) => {
    const result = await matchingService.listApplications(tenant(req), shop(req));
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Applications retrieved', data: result });
  }),
};
