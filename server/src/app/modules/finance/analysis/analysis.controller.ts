import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../../shared/catchAsync';
import sendResponse from '../../../../shared/sendResponse';
import { analysisService } from './analysis.service';

const tenant = (req: Request) => req.tenantId as string;
const shop = (req: Request) => (req.query.shopId ?? req.body?.shopId) as string;
const ok = (res: Response, message: string, data: unknown, code: number = httpStatus.OK) =>
  sendResponse(res, { success: true, statusCode: code, message, data });

export const analysisController = {
  measureCapitalDecision: catchAsync(async (req: Request, res: Response) => ok(res, '30-day observed outcome measured; not causal attribution', await analysisService.measureCapitalDecision(tenant(req), shop(req), req.params.id))),
  getMetrics: catchAsync(async (req: Request, res: Response) => ok(res, 'Metric pack computed', await analysisService.getMetrics(tenant(req), shop(req)))),
  getProductEconomics: catchAsync(async (req: Request, res: Response) => ok(res, 'Product economics computed', await analysisService.getProductEconomics(tenant(req), shop(req)))),
  getWorkingCapital: catchAsync(async (req: Request, res: Response) => ok(res, 'Working capital computed', await analysisService.getWorkingCapital(tenant(req), shop(req)))),
  getBreakeven: catchAsync(async (req: Request, res: Response) => ok(res, 'Breakeven computed', await analysisService.getBreakeven(tenant(req), shop(req)))),
  getConcentration: catchAsync(async (req: Request, res: Response) => ok(res, 'Concentration computed', await analysisService.getConcentration(tenant(req), shop(req)))),
  listInsights: catchAsync(async (req: Request, res: Response) => ok(res, 'Verified insights retrieved', await analysisService.listInsights(tenant(req), shop(req), req.query))),
  generateInsights: catchAsync(async (req: Request, res: Response) => ok(res, 'Insights generated and verified', await analysisService.generateInsights(tenant(req), req.body.shopId), httpStatus.CREATED)),
  verifyInsight: catchAsync(async (req: Request, res: Response) => ok(res, 'Verification re-run', await analysisService.verifyInsight(tenant(req), shop(req), req.params.id))),
  dismissInsight: catchAsync(async (req: Request, res: Response) => ok(res, 'Insight dismissed', await analysisService.dismissInsight(tenant(req), shop(req), req.params.id))),
  createScenario: catchAsync(async (req: Request, res: Response) => ok(res, 'Scenario simulated', await analysisService.createScenario(tenant(req), req.body.shopId, req.body), httpStatus.CREATED)),
  listScenarios: catchAsync(async (req: Request, res: Response) => ok(res, 'Scenarios retrieved', await analysisService.listScenarios(tenant(req), shop(req)))),
  recommendScenario: catchAsync(async (req: Request, res: Response) => ok(res, 'Scenarios ranked by expected value', await analysisService.recommendScenario(tenant(req), shop(req), req.params.id))),
  getForecast: catchAsync(async (req: Request, res: Response) => ok(res, 'Forecast computed', await analysisService.getForecast(tenant(req), shop(req), (req.query.target as string) ?? 'REVENUE', Number(req.query.horizon ?? 30)))),
  createCapitalDecision: catchAsync(async (req: Request, res: Response) => ok(res, 'Capital decision proposed', await analysisService.createCapitalDecision(tenant(req), req.body.shopId, req.body), httpStatus.CREATED)),
  listCapitalDecisions: catchAsync(async (req: Request, res: Response) => ok(res, 'Capital decisions retrieved', await analysisService.listCapitalDecisions(tenant(req), shop(req)))),
  approveCapitalDecision: catchAsync(async (req: Request, res: Response) => ok(res, 'Capital decision approved — tracking started', await analysisService.approveCapitalDecision(tenant(req), shop(req), req.params.id))),
  getReport: catchAsync(async (req: Request, res: Response) => ok(res, 'Report composed', await analysisService.getReport(tenant(req), shop(req)))),
};
