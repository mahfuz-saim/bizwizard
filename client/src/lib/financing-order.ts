export function financingOrder(a: { eligibilityStatus: string; finalScore: number }, b: { eligibilityStatus: string; finalScore: number }) {
  const rank = (status: string) => status === "ELIGIBLE" ? 0 : status === "NEAR_MISS" ? 1 : 2
  return rank(a.eligibilityStatus) - rank(b.eligibilityStatus) || b.finalScore - a.finalScore
}
