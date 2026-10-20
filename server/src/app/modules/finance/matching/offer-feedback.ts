export function explainOfferBlocker(reason: string): string {
  let match = /^rate (\S+) exceeds owner ceiling (\S+)$/.exec(reason);
  if (match) return `The lender's rate is ${match[1]}%, above your ${match[2]}% maximum.`;
  match = /^advance rate (\S+) exceeds policy cap (\S+)$/.exec(reason);
  if (match) return `The lender's advance rate is ${Number(match[1]) * 100}%, above the allowed ${Number(match[2]) * 100}%.`;
  if (reason.startsWith('amount ')) return 'The offered amount is outside the affordable borrowing limit.';
  if (reason.startsWith('rate ')) return "The lender's rate exceeds the product's allowed rate.";
  if (reason.startsWith('tenor ')) return 'The repayment period is outside the product\'s allowed range.';
  return 'The offer failed a financial safety check.';
}
