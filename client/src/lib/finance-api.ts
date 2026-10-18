import { api, getShopId } from "./api"
import { formatNumber } from "./utils"

/**
 * SME Finance Copilot API (PLAN §4.5/§5.5/§6.7/§7.4).
 * All money figures arrive already rounded by the server (roundCurrency);
 * normalizers here only shape payloads for the pages and never recompute
 * financial numbers in the browser.
 */
export const fmtBDT = (n: number | null | undefined) =>
  `৳${Math.round(Number(n ?? 0)).toLocaleString("en-IN")}`
// At most 2 fraction digits, no padded trailing zero (e.g. "12%" not "12.0%").
export const fmtPct = (n: number | null | undefined) => `${formatNumber(n, 2)}%`
export const fmtDecimal = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-IN", { maximumFractionDigits: 2 })

function shopParams(extra: Record<string, string | number | undefined> = {}) {
  return { shopId: getShopId() ?? "", ...extra }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function data(p: Promise<{ data?: unknown }>): Promise<any> {
  const res = await p
  return res.data
}

/* ------------------------------- Matching ------------------------------- */
export interface FinanceMatch {
  id: string; financeProductID: string; eligibilityStatus: string; failedRules: string[]
  deterministicScore: number; aiScore: number | null; finalScore: number
  aiRationale: string; aiTradeoffs: string[]; estimatedCost: number; maxAffordableAmount: number
  product?: { name: string; productType: string; interestRateMin: number; interestRateMax: number; provider?: { name: string } } | null
}
export interface FinanceOffer {
  id: string; financeProductID: string; offeredAmount: number; offeredRate: number
  tenorMonths: number; effectiveApr: number; totalRepayment: number; status: string
  rationale: string; conditions: string[]; confidence: number
}
export const matchingApi = {
  profile: () => data(api.get("/finance/matching/profile", shopParams())),
  providers: () => data(api.get("/finance/matching/providers", shopParams())),
  createMarket: (body: Record<string, unknown>) =>
    data(api.post("/finance/matching/market", { shopId: getShopId(), ...body })),
  run: (body: Record<string, unknown>) =>
    data(api.post("/finance/matching/run", { shopId: getShopId(), ...body })),
  results: () =>
    data(api.get("/finance/matching/results", shopParams())) as Promise<{
      matches: FinanceMatch[]; offers: FinanceOffer[]; simulatedMarket: boolean
    }>,
  negotiate: (offerId: string) =>
    data(api.post(`/finance/matching/offers/${offerId}/negotiate?shopId=${getShopId() ?? ""}`, {})),
  accept: (offerId: string) =>
    data(api.post(`/finance/matching/offers/${offerId}/accept?shopId=${getShopId() ?? ""}`, {})),
  reject: (offerId: string) =>
    data(api.post(`/finance/matching/offers/${offerId}/reject?shopId=${getShopId() ?? ""}`, {})),
  applications: () => data(api.get("/finance/matching/applications", shopParams())),
}

/* ------------------------------- Cashflow ------------------------------- */
export interface CashAlert {
  id: string; alertType: string; severity: string; title: string; message: string
  aiNarrative?: string | null; status: string; projectedShortfall?: number | null
  recommendedActions?: Array<{ actionType: string; description: string; projectedImpact: number }>
}
export const cashflowApi = {
  accounts: () => data(api.get("/finance/cashflow/accounts", shopParams())),
  transactions: () => data(api.get("/finance/cashflow/transactions", shopParams({ limit: 30 }))),
  createTransaction: (body: Record<string, unknown>) =>
    data(api.post("/finance/cashflow/transactions", { shopId: getShopId(), ...body })),
  backfill: () => data(api.post("/finance/cashflow/backfill", { shopId: getShopId() })),
  projection: (horizon = 90) => data(api.get("/finance/cashflow/projection", shopParams({ horizon }))),
  run: () => data(api.post("/finance/cashflow/run", { shopId: getShopId() })),
  alerts: () => data(api.get("/finance/cashflow/alerts", shopParams({ status: "OPEN" }))) as Promise<CashAlert[]>,
  ackAlert: (id: string, action: "ack" | "dismiss" | "resolve") =>
    data(api.post(`/finance/cashflow/alerts/${id}/ack?shopId=${getShopId() ?? ""}`, { action })),
  executeAlert: (id: string, body: Record<string, unknown>) =>
    data(api.post(`/finance/cashflow/alerts/${id}/execute?shopId=${getShopId() ?? ""}`, body)),
  commitments: () => data(api.get("/finance/cashflow/commitments", shopParams())),
  settleCommitment: (id: string, expenseItemID: string) => data(api.post(`/finance/cashflow/commitments/${id}/settle?shopId=${encodeURIComponent(getShopId() ?? "")}`, { expenseItemID })),
  createCommitment: (body: Record<string, unknown>) =>
    data(api.post("/finance/cashflow/commitments", { shopId: getShopId(), ...body })),
  extractCommitment: (text: string) =>
    data(api.post("/finance/cashflow/extract-commitment", { shopId: getShopId(), text })),
  treasuryActions: () => data(api.get("/finance/cashflow/treasury-actions", shopParams())),
  collectionEvidence: (id: string) => data(api.get(`/finance/cashflow/treasury-actions/${id}/evidence`, shopParams())) as Promise<{ id: string; amount: number; createdAt: string }[]>,
  recordCollection: (id: string, paymentID: string) => data(api.post(`/finance/cashflow/treasury-actions/${id}/evidence?shopId=${getShopId() ?? ""}`, { paymentID })),
  decideAction: (id: string, approve: boolean) =>
    data(api.post(`/finance/cashflow/treasury-actions/${id}/${approve ? "approve" : "reject"}?shopId=${getShopId() ?? ""}`, {})),
}

/* ------------------------------- Analysis -------------------------------- */
export const analysisApi = {
  metrics: () => data(api.get("/finance/analysis/metrics", shopParams())),
  productEconomics: () => data(api.get("/finance/analysis/product-economics", shopParams())),
  workingCapital: () => data(api.get("/finance/analysis/working-capital", shopParams())),
  breakeven: () => data(api.get("/finance/analysis/breakeven", shopParams())),
  concentration: () => data(api.get("/finance/analysis/concentration", shopParams())),
  insights: () => data(api.get("/finance/analysis/insights", shopParams())),
  generateInsights: () => data(api.post("/finance/analysis/insights/generate", { shopId: getShopId() })),
  dismissInsight: (id: string) =>
    data(api.post(`/finance/analysis/insights/${id}/dismiss?shopId=${getShopId() ?? ""}`, {})),
  createScenario: (body: Record<string, unknown>) =>
    data(api.post("/finance/analysis/scenarios", { shopId: getShopId(), ...body })),
  scenarios: () => data(api.get("/finance/analysis/scenarios", shopParams())),
  recommendScenario: (id: string) =>
    data(api.post(`/finance/analysis/scenarios/${id}/recommend?shopId=${getShopId() ?? ""}`, {})),
  forecast: () => data(api.get("/finance/analysis/forecast", shopParams())),
  capitalDecisions: () => data(api.get("/finance/analysis/capital-decisions", shopParams())),
  createCapitalDecision: (body: Record<string, unknown>) =>
    data(api.post("/finance/analysis/capital-decisions", { shopId: getShopId(), ...body })),
  approveCapitalDecision: (id: string) =>
    data(api.post(`/finance/analysis/capital-decisions/${id}/approve?shopId=${getShopId() ?? ""}`, {})),
  measureCapitalDecision: (id: string) => data(api.post(`/finance/analysis/capital-decisions/${id}/measure?shopId=${getShopId() ?? ""}`, {})),
  report: () => data(api.get("/finance/analysis/report", shopParams())),
}

/* -------------------------------- Agents --------------------------------- */
export const agentsApi = {
  evaluations: () => data(api.get("/finance/agents/evaluations", shopParams())),
  runEvaluation: () => data(api.post(`/finance/agents/evaluations?shopId=${encodeURIComponent(getShopId() ?? "")}`, {})),
  evaluation: (id: string) => data(api.get(`/finance/agents/evaluations/${encodeURIComponent(id)}`, shopParams())),
  sandboxComparison: () => data(api.get("/finance/agents/sandbox-comparison", shopParams())),
  policies: () => data(api.get("/finance/agents/policies", shopParams())),
  updatePolicy: (id: string, body: Record<string, unknown>) =>
    data(api.patch(`/finance/agents/policies/${id}?shopId=${getShopId() ?? ""}`, body)),
  decisions: () => data(api.get("/finance/agents/decisions", shopParams())),
  runs: () => data(api.get("/finance/agents/runs", shopParams())),
  performance: () => data(api.get("/finance/agents/performance", shopParams())),
  auditExport: () => data(api.get("/finance/agents/audit-export", shopParams())),
}

/** Normalize any finance payload row for display (keeps numbers untouched). */
export function normalizeRow<T extends Record<string, unknown>>(row: T): T & { key: string } {
  const id = (row.id as string) ?? (row.metricKey as string) ?? JSON.stringify(row).slice(0, 24)
  return { ...row, key: String(id) }
}
