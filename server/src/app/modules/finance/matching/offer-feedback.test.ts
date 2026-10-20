import assert from 'node:assert/strict';
import { test } from 'node:test';
import { explainOfferBlocker } from './offer-feedback';

test('offer blockers explain rate ceilings and advance limits without changing them', () => {
  assert.equal(explainOfferBlocker('rate 13.19 exceeds owner ceiling 12'), "The lender's rate is 13.19%, above your 12% maximum.");
  assert.equal(explainOfferBlocker('advance rate 1 exceeds policy cap 0.85'), "The lender's advance rate is 100%, above the allowed 85%.");
  assert.match(explainOfferBlocker('amount 500 exceeds affordability cap 400'), /affordable borrowing limit/);
  assert.match(explainOfferBlocker('rate 18 exceeds product max 16'), /product's allowed rate/);
  assert.match(explainOfferBlocker('tenor 12 outside product bounds'), /repayment period/i);
  assert.equal(explainOfferBlocker('unknown check'), 'The offer failed a financial safety check.');
});
