import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../../shared/catchAsync';
import sendResponse from '../../../../shared/sendResponse';
import { agentsService } from './agents.service';

const tenant = (req: Request) => req.tenantId as string;
const shop = (req: Request) => (req.query.shopId ?? req.body?.shopId) as string;
const ok = (res: Response, message: string, data: unknown) =>
  sendResponse(res, { success: true, statusCode: httpStatus.OK, message, data });

export const agentsController = {
  listPolicies: catchAsync(async (req: Request, res: Response) => ok(res, 'Agent mandates retrieved', await agentsService.listPolicies(tenant(req)))),
  updatePolicy: catchAsync(async (req: Request, res: Response) => ok(res, 'Mandate updated (new version)', await agentsService.updatePolicy(req.params.id, req.body))),
  listDecisions: catchAsync(async (req: Request, res: Response) => ok(res, 'Decision ledger retrieved', await agentsService.listDecisions(tenant(req), shop(req), req.query.agentType as string | undefined))),
  listRuns: catchAsync(async (req: Request, res: Response) => ok(res, 'AI runs retrieved', await agentsService.listRuns(tenant(req)))),
  performance: catchAsync(async (req: Request, res: Response) => ok(res, 'Scorecards computed (alpha vs pinned benchmark)', await agentsService.performance(tenant(req), shop(req)))),
  auditExport: catchAsync(async (req: Request, res: Response) => {
    const data = await agentsService.auditExport(tenant(req), shop(req));
    res.setHeader('Content-Disposition', 'attachment; filename="finance-agent-audit.json"');
    ok(res, 'Audit export', data);
  }),
};
