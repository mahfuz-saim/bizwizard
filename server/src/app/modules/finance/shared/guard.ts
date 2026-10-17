import { MAX_ADVANCE_RATE } from './affordability';

/**
 * Guard layer (PLAN §1.2 rule 5, §4.3[7], §5.3[6]). Runs AFTER generation on
 * every AI-produced figure. A breach voids the output and is recorded as a
 * scored mistake — guards beat instructions, always.
 */
export interface GuardVerdict {
  passed: boolean;
  reasons: string[];
}

export function guardOffer(input: {
  offeredAmount: number;
  offeredRate: number;
  tenorMonths: number;
  advanceRate: number;
  maxAffordableAmount: number;
  ownerMaxRate?: number | null;
  productMinTenor: number;
  productMaxTenor: number;
  productRateMax: number;
}): GuardVerdict {
  const reasons: string[] = [];
  if (input.offeredAmount > input.maxAffordableAmount)
    reasons.push(`amount ${input.offeredAmount} exceeds affordability cap ${input.maxAffordableAmount}`);
  if (input.offeredAmount <= 0) reasons.push('amount must be positive');
  if (input.offeredRate > input.productRateMax)
    reasons.push(`rate ${input.offeredRate} exceeds product max ${input.productRateMax}`);
  if (input.ownerMaxRate != null && input.offeredRate > input.ownerMaxRate)
    reasons.push(`rate ${input.offeredRate} exceeds owner ceiling ${input.ownerMaxRate}`);
  if (input.tenorMonths < input.productMinTenor || input.tenorMonths > input.productMaxTenor)
    reasons.push(`tenor ${input.tenorMonths} outside product bounds`);
  if (input.advanceRate > MAX_ADVANCE_RATE)
    reasons.push(`advance rate ${input.advanceRate} exceeds policy cap ${MAX_ADVANCE_RATE}`);
  return { passed: reasons.length === 0, reasons };
}

export function guardTreasuryActions(input: {
  actions: Array<{ actionType: string; amount: number; projectedImpact: number }>;
  maxExposure?: number | null;
  /** projected balance on every horizon day AFTER the actions */
  projectedBalancesAfter: number[];
  bufferFloorAmount: number;
}): GuardVerdict {
  const reasons: string[] = [];
  const total = input.actions.reduce((a, x) => a + Math.abs(x.amount), 0);
  if (input.maxExposure != null && total > input.maxExposure)
    reasons.push(`total action amount ${total} exceeds mandate maxExposure ${input.maxExposure}`);
  const breachesFloor = input.projectedBalancesAfter.some((b) => b < input.bufferFloorAmount);
  const movesMoney = input.actions.some((a) => a.actionType !== 'HOLD_CASH' && a.actionType !== 'ESCALATE');
  if (movesMoney && breachesFloor)
    reasons.push('an action would leave projected balance below the buffer floor');
  const sweep = input.actions.find((a) => a.actionType === 'SWEEP_IDLE_CASH');
  if (sweep && breachesFloor) reasons.push('sweep would breach the buffer floor');
  return { passed: reasons.length === 0, reasons };
}

/** Clamp an LLM score adjustment to ±15 points of the deterministic score (§4.3[4]). */
export function clampAiScore(deterministicScore: number, aiScore: number): number {
  const clamped = Math.max(deterministicScore - 15, Math.min(deterministicScore + 15, aiScore));
  return Math.max(0, Math.min(100, Math.round(clamped * 100) / 100));
}

export const blendScore = (deterministic: number, ai: number | null): number =>
  ai === null
    ? Math.round(deterministic * 100) / 100
    : Math.round((0.6 * deterministic + 0.4 * ai) * 100) / 100;
