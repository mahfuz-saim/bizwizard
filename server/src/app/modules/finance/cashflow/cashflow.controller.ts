import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../../shared/catchAsync';
import sendResponse from '../../../../shared/sendResponse';
import { cashflowService } from './cashflow.service';

const tenant = (req: Request) => req.tenantId as string;
const shop = (req: Request) => (req.query.shopId ?? req.body?.shopId) as string;

export const cashflowController = {
  settleCommitment: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.settleCommitment(tenant(req), shop(req), req.params.id, req.body.expenseItemID);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Existing purchase linked; no additional payment created', data: result });
  }),
  collectionEvidence: catchAsync(async (req: Request, res: Response) => {
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Available recorded collections', data: await cashflowService.collectionEvidence(tenant(req), shop(req), req.params.id) });
  }),
  recordCollection: catchAsync(async (req: Request, res: Response) => {
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Recorded collection linked; no new payment created', data: await cashflowService.recordCollection(tenant(req), shop(req), req.params.id, req.body.paymentID) });
  }),
  listAccounts: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.listAccounts(tenant(req), shop(req));
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Cash accounts retrieved', data: result });
  }),
  createAccount: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.createAccount(tenant(req), req.body.shopId, req.body);
    sendResponse(res, { success: true, statusCode: httpStatus.CREATED, message: 'Cash account created', data: result });
  }),
  listTransactions: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.listTransactions(tenant(req), shop(req), req.query);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Transactions retrieved', data: result, meta: result.meta });
  }),
  createTransaction: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.createTransaction(tenant(req), req.body.shopId, req.body);
    sendResponse(res, { success: true, statusCode: httpStatus.CREATED, message: 'Transaction recorded', data: result });
  }),
  recategorize: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.recategorize(tenant(req), shop(req), req.params.id);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Transaction recategorized', data: result });
  }),
  backfill: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.backfill(tenant(req), req.body.shopId);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Ledger backfilled from business history', data: result });
  }),
  getProjection: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.getProjection(tenant(req), shop(req), Number(req.query.horizon ?? 90));
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Projection computed', data: result });
  }),
  runTreasury: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.runTreasury(tenant(req), req.body.shopId);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Treasury run complete', data: result });
  }),
  listAlerts: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.listAlerts(tenant(req), shop(req), req.query.status as string | undefined);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Alerts retrieved', data: result });
  }),
  ackAlert: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.ackAlert(tenant(req), shop(req), req.params.id, req.body);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Alert updated', data: result });
  }),
  executeAlert: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.executeAlertAction(tenant(req), shop(req), req.params.id, req.body);
    sendResponse(res, { success: true, statusCode: httpStatus.CREATED, message: 'Recommendation proposed for review; no money moved', data: result });
  }),
  listCommitments: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.listCommitments(tenant(req), shop(req));
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Commitments retrieved', data: result });
  }),
  createCommitment: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.createCommitment(tenant(req), req.body.shopId, req.body);
    sendResponse(res, { success: true, statusCode: httpStatus.CREATED, message: 'Commitment created', data: result });
  }),
  extractCommitment: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.extractCommitment(tenant(req), req.body.shopId, req.body.text);
    sendResponse(res, { success: true, statusCode: httpStatus.CREATED, message: 'Commitment extracted', data: result });
  }),
  listTreasuryActions: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.listTreasuryActions(tenant(req), shop(req));
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Treasury actions retrieved', data: result });
  }),
  approveAction: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.decideTreasuryAction(tenant(req), shop(req), req.params.id, true);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Action approved; complete and record the actual transaction separately', data: result });
  }),
  rejectAction: catchAsync(async (req: Request, res: Response) => {
    const result = await cashflowService.decideTreasuryAction(tenant(req), shop(req), req.params.id, false);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: 'Action rejected', data: result });
  }),
};
