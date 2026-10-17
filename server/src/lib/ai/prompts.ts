import { z } from 'zod';

/**
 * Versioned prompt registry (PLAN §7.2). Every prompt: explicit mandate +
 * limits, JSON-schema-constrained output, and a deterministic postProcess the
 * model cannot bypass. Bump `version` on any wording change.
 */
export const PROMPT_VERSION = 'v1';

export const rankFinancingProducts = {
  version: PROMPT_VERSION,
  tier: 'reasoning' as const,
  system:
    'You are a credit analyst at a digital lending marketplace. You may NOT change eligibility. ' +
    'You may adjust a score by at most 15 points from the deterministic score given. Every rationale ' +
    'MUST cite at least one metric from the profile. Reply with JSON only.',
  outputSchema: z.object({
    results: z.array(
      z.object({
        productId: z.string(),
        aiScore: z.number().min(0).max(100),
        rationale: z.string().min(20),
        tradeoffs: z.array(z.string()).min(2).max(3),
      }),
    ),
  }),
};

export const priceOffer = {
  version: PROMPT_VERSION,
  tier: 'reasoning' as const,
  system:
    'You are the AI lender. The rate band and risk premium are computed for you; choose positioning ' +
    '(advance rate, tenor, conditions) and explain the risk drivers using the given metrics. ' +
    'You may decline by returning decline=true. Reply with JSON only.',
  outputSchema: z.object({
    decline: z.boolean(),
    advanceRate: z.number().min(0).max(0.85),
    tenorMonths: z.number().int().min(1).max(60),
    conditions: z.array(z.string()).max(5),
    rationale: z.string().min(20),
    confidence: z.number().min(0).max(1),
  }),
};

export const evaluateOffer = {
  version: PROMPT_VERSION,
  tier: 'reasoning' as const,
  system:
    'You are the borrower\'s advocate. Judge the offer ONLY on total repayment cost, cash-flow ' +
    'feasibility (installment ≤ 35% of monthly free cash flow), collateral burden and covenant risk — ' +
    'metrics are supplied. Choose accept, counter (with concrete terms) or reject. Reply with JSON only.',
  outputSchema: z.object({
    decision: z.enum(['ACCEPT', 'COUNTER', 'REJECT']),
    proposedRate: z.number().min(0).max(100).optional(),
    proposedTenorMonths: z.number().int().min(1).max(60).optional(),
    proposedAmount: z.number().min(0).optional(),
    message: z.string().min(10),
    reasoning: z.string().min(10),
  }),
};

export const categorizeTransaction = {
  version: PROMPT_VERSION,
  tier: 'fast' as const,
  system: 'Classify one cash transaction description into the given category list. JSON only.',
  outputSchema: z.object({
    category: z.string(),
    confidence: z.number().min(0).max(1),
  }),
};

export const narrateAlerts = {
  version: PROMPT_VERSION,
  tier: 'fast' as const,
  system:
    'You prioritise already-computed cash alerts by business impact. Do NOT invent numbers; use only ' +
    'the figures given. Name the single most important action and why. JSON only.',
  outputSchema: z.object({
    narrative: z.string().min(20),
    priorityOrder: z.array(z.string()),
    topAction: z.string(),
  }),
};

export const chooseTreasuryActions = {
  version: PROMPT_VERSION,
  tier: 'reasoning' as const,
  system:
    'You are the treasurer. Choose a subset of the pre-computed action menu; every impact figure is ' +
    'supplied and must not be altered. Cite the constraint each pick serves. JSON only.',
  outputSchema: z.object({
    actionIds: z.array(z.string()),
    rationale: z.string().min(10),
    rejections: z.array(z.string()),
  }),
};

export const extractCommitment = {
  version: PROMPT_VERSION,
  tier: 'fast' as const,
  system: 'Extract a scheduled payment obligation from free text. Dates as ISO strings. JSON only.',
  outputSchema: z.object({
    name: z.string().min(2),
    amount: z.number().min(0),
    dueDate: z.string(),
    recurrence: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
    confidence: z.number().min(0).max(1),
  }),
};

export const hypothesizeAnomalies = {
  version: PROMPT_VERSION,
  tier: 'reasoning' as const,
  system:
    'For each anomaly, rank the supplied candidate contributors by likely contribution and state the ' +
    'mechanism. Candidates are opaque IDs; never invent entities or numbers. JSON only.',
  outputSchema: z.object({
    results: z.array(
      z.object({
        anomalyDate: z.string(),
        hypotheses: z.array(
          z.object({
            candidateId: z.string(),
            mechanism: z.string().min(5),
            confidence: z.number().min(0).max(1),
          }),
        ),
      }),
    ),
  }),
};

export const rankScenarios = {
  version: PROMPT_VERSION,
  tier: 'reasoning' as const,
  system:
    'Rank pre-simulated scenarios by the expected value supplied. Explain the trade-off of the top ' +
    'pick. If the owner\'s own scenario has the best EV, say so. JSON only.',
  outputSchema: z.object({
    rankedIds: z.array(z.string()),
    recommendation: z.string().min(10),
  }),
};

export const narrateProjection = {
  version: PROMPT_VERSION,
  tier: 'fast' as const,
  system:
    'Explain the computed cash projection in the owner\'s language using only the figures given. JSON only.',
  outputSchema: z.object({ narrative: z.string().min(20), confidence: z.number().min(0).max(1) }),
};
