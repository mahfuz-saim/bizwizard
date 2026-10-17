# SME Finance Copilot — how it works, how to run it

Implements `PLAN.md` (AI as a financial participant) on the existing BizWizard
stack. Thesis in one line: **the AI holds a mandate and a position, takes
binding decisions inside deterministic guards, and is scored against a pinned
rule-based benchmark — alpha = realized − benchmark.**

## The three pillars + the ledger

| Screen (client) | API base | What happens |
| --- | --- | --- |
| `/finance/cashflow` | `/api/v1/finance/cashflow/*` | Cash ledger, commitments, deterministic 90-day projection, 9 alert rules, TREASURER_AGENT actions (proposed → approved → executed → reconciled) |
| `/finance/matching` | `/api/v1/finance/matching/*` | Rule-gated product matching → AI re-rank (±15 clamp) → LENDER_AGENT prices concurrently → BORROWER_AGENT negotiates ≤3 rounds → owner accepts → application + amortization schedule |
| `/finance/analysis` | `/api/v1/finance/analysis/*` | 30-metric pack, product quadrants, ANALYST_AGENT hypotheses **verified by counterfactual recomputation** (only VERIFIED reach the feed), scenarios ranked by EV, capital decisions measured at 30/60 days |
| `/finance/agent` | `/api/v1/finance/agents/*` | Mandates (versioned), decision ledger, scorecards with benchmark alpha, AiRun cost/latency, audit JSON export |

Every number is computed in TypeScript (`shared/metricEngine.ts`,
`shared/cashEngine.ts`, `shared/money.ts`). The LLM — when a key is configured —
only selects from pre-computed options and explains. **With no
`OPENAI_API_KEY` the system runs on the deterministic core**
(`model = "deterministic-fallback"`, $0/run) and remains fully functional;
that is the tested default in CI.

## Manage & run

### 1. Configure

`server/.env` (see `.env.example`): the usual `DATABASE_URL`, JWT secrets, plus
optionally:

```bash
OPENAI_API_KEY=            # optional — omit for deterministic mode
OPENAI_MODEL_FAST=gpt-4o-mini
OPENAI_MODEL_REASONING=gpt-4.1
AI_PLAN_BUDGET_USD=2.00
AI_FEATURE_FLAGS=matching,cashflow,analysis,agents
```

`client/.env.local`: `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1`.

### 2. Install, migrate, seed

```bash
cd server && npm ci
npm run prisma:generate
npm run prisma:migrate -- --name finance_copilot   # or: npx prisma migrate deploy (migration 20261017090000_finance_copilot is committed)
npm run seed            # existing business seed (owners/shops/history)
npm run seed:finance    # 7 providers, 12 products, 4 agent mandates, cash accounts, AiRun history
cd ../client && npm ci
```

The committed migration is additive only (24 new tables, 35 new enums; no
existing table is altered). Catalogs and mandates also self-seed idempotently
on first API use, so the finance screens work even if `seed:finance` is skipped.

### 3. Run

```bash
# terminal 1 — API on :5000 (PORT from .env)
cd server && npm run dev
# terminal 2 — web on :3000
cd client && npm run dev
```

Log in, pick a shop, then open **Cash Flow → Backfill ledger → Run treasurer**
to populate the projection, alerts and guarded actions. A daily 06:00 cron
(`src/app/modules/finance/cron/financeCron.service.ts`, wired in `src/app.ts`)
repeats the treasury run per shop, marks overdue installments, and reconciles
executed actions after 7 days.

### 4. Test

```bash
cd server && npm test           # node:test cases: money/concurrency/engines/eligibility/guard/verifier/benchmarks/negotiation/AI-runtime/naming/simulator-plan
cd client && npm test           # payload normalization + existing suites
cd client && npm run test:backend-contract   # client payloads vs real server Zod schemas
```

No test touches the network or a database: the OpenAI client is injected, the
engines are pure functions, and the benchmarks are checked against
hand-computed expectations (including the fairness rules — same ELIGIBLE
universe, same PD/LGD model, benchmark charged for loans the AI declined).

## Design contracts (do not break)

- **Naming (§2.1):** new Prisma columns are `tenantID` / `shopID` / `<entity>ID`;
  service params are `tenantId`/`shopId`; the tenant comes only from the
  `x-tenant-id` header. Enforced by `shared/naming.test.ts`.
- **Money (§2.2):** `Float` + `roundCurrency` at every boundary; aggregate raw,
  round once; running balances rounded per step.
- **Guards beat instructions:** offers above the affordability cap, rates above
  the owner's ceiling, advance rates > 0.85, and treasury actions breaching the
  buffer floor are voided and logged as scored mistakes (`REJECTED_BY_GUARD`).
- **Benchmarks pinned** in `agents/benchmarks.ts` (`pinned-v1`): flat-rate
  lender (clamped to band), round-0 lowest-APR borrower, hold/collect-at-60d
  treasurer, equal-weight analyst. Changing them requires a version bump so
  historical alpha stays interpretable.

## Judge demo: the 30-day simulator

A judge-facing "fast-forward" button that drives the *real* pipeline above
with fabricated-but-real data, instead of asking anyone to wait 30 actual
days or stare at an empty shop. Nothing about the three pillars changes for
this: the simulator writes ordinary rows into the owner's own currently open
shop, then calls the same `cashflowService.runTreasury`,
`analysisService.generateInsights`-grade verifier, and
`agentsService.performance` that real usage calls.

| Piece | Where |
| --- | --- |
| Deterministic 30-day plan (sales/expenses/debts/engineered anomaly/guard-blocked offer/reconciled collection), seeded from `shopId + runID` | `server/src/app/modules/finance/simulator/simulatorEngine.ts` (pure, unit-tested, no DB) |
| Orchestration: writes real `Checkout`/`ExpenseItem`/`Debt`/`DebtPayments`/`CashTransaction` rows in one transaction, then re-runs `cashflowService.runTreasury`, builds a guard-verified `TreasuryAction`, a guard-rejected lender `AiDecision`, a VERIFIED `Insight`, and `agentsService.performance` | `server/src/app/modules/finance/simulator/simulator.service.ts` |
| API | `POST /finance/simulator/fast-forward` (runs all 30 days, <1s typical on a local DB — see caveat below), `GET /finance/simulator/inspect?type=&id=` (returns the real row), `POST /finance/simulator/reset` (wipes only simulator-tagged rows) |
| Client | `client/src/lib/simulator-context.tsx` drip-feeds the single response at 150ms/day (~4.5s) into three layers: a collapsible "Live Business Stream" drawer with a `[↗]` inspect action per row (Layer 1), in-place chart/gauge/insight/scorecard morphing on `/finance/cashflow`, `/finance/analysis`, `/finance/agent` (Layer 2), and up to two high-signal milestone toasts — 🚨 critical shortfall, 🛡️ guardrail-blocked offer, 📈 reconciled alpha (Layer 3) |

**How "real, not staged" is enforced:** every row the simulator writes gets
`isSimulated: true` + `simulationRunID` (additive migration, see
`20261017120000_finance_simulator`); the `[↗]` icon in the stream opens the
literal database record via `GET /finance/simulator/inspect`. The CRITICAL
alert, the guard rejection, and the reconciled treasury action are not
hand-rolled strings — they come out of the same `evaluateAlerts`,
`guardOffer`/`guardTreasuryActions`, and `verifyHypothesis` functions real
traffic uses; the simulator only engineers the *inputs* (a shortfall-shaped
30 days, a high-APR product pricing) that make those real functions land on
the demo-relevant branch. `reset()` diffs against alerts that were already
OPEN before the run so it only deletes what the run actually created.

**Honest caveat:** "fast backend transaction" here means one Postgres
transaction, not a literal sub-200ms wall-clock guarantee — on a remote/managed
database the ~150 sequential writes a 30-day run performs will typically take
low seconds, not milliseconds; the transaction timeout is set generously
(30s) to avoid failing on slower connections. The drip-feed animation starts
as soon as the single response arrives, so the perceived 4.5s playback is
accurate regardless of backend latency.

## Honest limitations (v1, per PLAN §12)

Simulated market only — no real lender is contacted and no real money moves;
all executions are owner-approved. Payables are not tracked by the existing
schema, so DPO reads 0 until supplier balances exist. COGS falls back to a 70%
estimate only for checkout items whose lot was deleted (surfaced through
`dataCompleteness`, and matching refuses to guess below 60% completeness).
Forecast MAPE is shown even when poor — that is deliberate.
