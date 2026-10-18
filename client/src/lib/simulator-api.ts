import { api, getShopId, getSimulationSourceId } from "./api"

/**
 * Judge-facing Finance Copilot simulator: plays 30 fabricated-but-real
 * business days into a separate demo copy in a single atomic
 * backend transaction, then re-runs the real deterministic pipeline
 * (cashEngine, alert rules, guard, counterfactual verifier, agent
 * scorecards) on top of it. The frontend drip-feeds the returned
 * `dailyEvents` into the UI; no numbers are invented in the browser.
 */

export type StreamEventType = "CHECKOUT" | "EXPENSE_ITEM" | "DEBT_PAYMENT" | "CASH_TRANSACTION"

/** 'LESS' (default) keeps today's pace — one sale + occasional expense/day.
 *  'MORE' fans the same daily totals out into ~3x as many smaller rows for a
 *  visibly busier live stream. Either way every row is a real, tagged write. */
export type SimTemplate = "LESS" | "MORE"

export interface SimDailyStreamEvent {
  type: StreamEventType
  id: string
  amount: number
  direction: "IN" | "OUT"
  description: string
  occurredAt: string
}

export interface SimDailyStreamDay {
  day: number
  date: string
  phase: string
  events: SimDailyStreamEvent[]
  runningBalance: number
  revenue: number
  expense: number
}

export interface SimToast {
  occurredAt: string
  id: "critical" | "guard" | "reconciled"
  kind: "critical" | "guard" | "reconciled"
  uiCueDay: number
  title: string
  message: string
  actionLabel: string
  actionHref: string
  refID: string
}

export interface SimBucket { date: string; inflow: number; outflow: number; closingBalance: number }
export interface SimProjection {
  dailyBuckets: SimBucket[]
  daysOfBuffer: number
  minProjectedBalance: number
  troughDate: string | null
  shortfallDate: string | null
  closingBalance: number
  currentCash: number
  narrative?: string | null
}

export interface SimAlert {
  id: string; alertType: string; severity: string; title: string; message: string
  projectedShortfall?: number | null
}

export interface SimTreasuryAction {
  id: string; title: string; rationale: string; amount: number
  projectedImpact: number; realizedImpact: number | null; status: string
}

export interface SimInsight {
  id: string; insightType: string; severity: string; title: string; summary: string
  hypothesis: string; verificationStatus: string; verifiedMetrics?: Record<string, unknown> | null
  candidates?: unknown[]
}

export interface SimPerformanceRow {
  agentType: string; decisionsCount: number; executedCount: number; guardRejects: number
  realizedImpactSum: number; benchmarkImpact: number; alpha: number; score: number
}

export interface FastForwardResult {
  shopID: string
  sourceShopID: string
  startedAt: string
  endedAt: string
  simulationRunID: string
  shopName: string
  dailyEvents: SimDailyStreamDay[]
  insight: SimInsight
  toasts: SimToast[]
  finalState: {
    projection: SimProjection
    projectionAfterAction: SimProjection
    alerts: SimAlert[]
    treasuryActions: SimTreasuryAction[]
    guardDecision: { id: string; action: string; rationale: string; guardResult: string } | null
    performance: SimPerformanceRow[]
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function data(p: Promise<{ data?: unknown }>): Promise<any> {
  const res = await p
  return res.data
}

export const simulatorApi = {
  prepare: () => data(api.post("/finance/simulator/prepare", { shopId: getSimulationSourceId() ?? getShopId() })) as Promise<{ id: string; simulationSourceShopID: string }>,
  workspace: () => data(api.get("/finance/simulator/workspace", { shopId: getShopId() ?? "" })) as Promise<{ simulationAsOf: string; simulationResult: FastForwardResult | null } | null>,
  fastForward: (template?: SimTemplate) =>
    data(api.post("/finance/simulator/fast-forward", { shopId: getShopId(), template })) as Promise<FastForwardResult>,
  reset: () => data(api.post("/finance/simulator/reset", { shopId: getShopId() })),
  inspect: (type: StreamEventType, id: string) =>
    data(api.get("/finance/simulator/inspect", { shopId: getShopId() ?? "", type, id })),
}
