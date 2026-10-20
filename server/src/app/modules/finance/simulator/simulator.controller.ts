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
    const wantsStream = req.body?.stream === true || String(req.query.stream ?? '') === '1';
    if (!wantsStream) {
      const result = await simulatorService.fastForward(tenant(req), req.body.shopId, req.body.template);
      sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: `Simulated ${result.dailyEvents.length} days in the isolated demo ledger; source shop unchanged`,
        data: result,
      });
      return;
    }

    // Streaming mode (NDJSON): every simulated day is pushed to the client as
    // soon as its rows exist, so the live stream can start revealing
    // transactions while the remaining days are still being simulated. The
    // final line carries the same result the JSON response would return.
    res.status(httpStatus.OK);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const write = (payload: unknown) => { res.write(`${JSON.stringify(payload)}\n`); };
    try {
      const result = await simulatorService.fastForward(tenant(req), req.body.shopId, req.body.template, {
        onDay: day => { write({ type: 'day', day }); },
        onCue: toast => { write({ type: 'cue', toast }); },
      });
      write({ type: 'result', result });
      res.end();
    } catch (error: any) {
      const status = typeof error?.statusCode === 'number' ? error.statusCode : 500;
      write({
        type: 'error',
        status,
        message: status < 500 ? String(error?.message ?? 'Simulation failed') : 'Simulation failed. Please try again.',
      });
      res.end();
    }
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
