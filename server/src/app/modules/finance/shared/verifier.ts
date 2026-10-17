import { roundCurrency } from './money';

/**
 * Counterfactual verifier (PLAN §6.4). The analyst proposes; the database
 * disposes. A hypothesis is VERIFIED only if removing its candidate from the
 * period collapses the residual gap to within 10% of the original gap.
 */
export interface Candidate {
  id: string;
  label: string;
  kind: string; // CUSTOMER | EXPENSE | PRODUCT | SUPPLIER | OTHER
  contribution: number; // signed contribution to the gap, computed deterministically
}
export interface Hypothesis {
  candidateId: string;
  mechanism: string;
  confidence: number;
}
export interface VerificationResult {
  status: 'VERIFIED' | 'REFUTED';
  residualGap: number;
  residualPct: number;
  verifiedMetrics: Record<string, number | string>;
}

export function verifyHypothesis(
  originalGap: number,
  candidate: Candidate,
): VerificationResult {
  const residualGap = roundCurrency(originalGap - candidate.contribution);
  const residualPct =
    originalGap === 0 ? 0 : roundCurrency((Math.abs(residualGap) / Math.abs(originalGap)) * 10000) / 100;
  const verified = Math.abs(originalGap) > 0 && residualPct <= 10;
  return {
    status: verified ? 'VERIFIED' : 'REFUTED',
    residualGap,
    residualPct,
    verifiedMetrics: {
      originalGap: roundCurrency(originalGap),
      candidateContribution: roundCurrency(candidate.contribution),
      residualGap,
      residualPct,
    },
  };
}

/**
 * Deterministic fallback hypothesis generator: rank the actual contributors.
 * Used when no LLM is configured — the analyst still only surfaces claims the
 * verifier can prove (PLAN §7.3 determinism-first).
 */
export function rankCandidates(candidates: Candidate[]): Hypothesis[] {
  return [...candidates]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .map((c) => ({
      candidateId: c.id,
      mechanism: `${c.label} accounts for ৳${Math.abs(roundCurrency(c.contribution)).toLocaleString('en-IN')} of the gap.`,
      confidence: 0.6,
    }));
}
