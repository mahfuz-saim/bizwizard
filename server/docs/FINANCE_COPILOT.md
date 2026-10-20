# SME Finance Copilot — how it works, how to run it

Implements `PLAN.md` (AI as a financial participant) on the existing BizWizard
stack. Thesis in one line: **the AI holds a mandate and a position, takes
decisions inside deterministic guards, and exposes evidence for evaluating
outcomes. Matched benchmark alpha remains pending until supported by evidence.**

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

Normal tests inject the OpenAI client and use local fixtures. Opt-in integration
tests additionally require an isolated local PostgreSQL database. The engines are pure functions, and the benchmarks are checked against
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

The simulator is owner/admin-only and uses a separate demo shop in the same
PostgreSQL database. It does not write simulated trading activity into the
source shop. The frontend marks the demo workspace and provides a return-to-source
button; normal inventory/sales writes are blocked in the demo UI.

1. `POST /finance/simulator/prepare` with the source `shopId` creates or reuses its
   demo workspace. It copies core sales, expenses, debts/payments, stock lots,
   customer/supplier links, cash accounts/transactions and commitments, remapping
   record IDs. Legacy simulated rows are excluded. Users, passwords, credentials
   and external-service settings are not copied.
2. `POST /finance/simulator/fast-forward` accepts only the demo `shopId` and an
   optional `LESS`/`MORE` template. It advances the persisted clock by 30 days,
   beginning the day after the latest copied activity (or the preceding run).
   Each day is evaluated by the real deterministic treasury pipeline using that
   day's clock. Projection narration uses the deterministic fallback inside the
   run, avoiding 30 external AI calls.
3. The database computation commits atomically before playback starts. Pause,
   resume and skip control **replay**, not database writes. Transactions can be
   inspected in the drawer. Notifications and milestone toasts show simulated
   timestamps and are revealed when playback reaches their transaction time.
   A reload restores the last committed run, rather than running it again.
   A run survives an access-token refresh (the client rotates the token on a
   401); only an ended session or a different account stops it, and the drawer
   then shows the reason instead of an empty stream.
4. `POST /finance/simulator/reset` accepts only a demo shop. It clears that
   workspace's ledger and derived finance outputs, notification/read records and
   run metadata, then copies the **current source baseline** again. It is not a
   command for cleaning old simulated rows out of a real source shop.

Prepare, run and reset use database transactions and advisory locks. A concurrent
operation on the same workspace is rejected; failed operations roll back. Runs
have a 120-second transaction timeout, not a wall-clock speed guarantee. The
additive migration `20261018120000_isolated_simulation_workspace` stores the
source relationship, baseline date, current date, run ID and last result. The
existing deployment pipeline applies it with `prisma migrate deploy`.

Verification includes `tests/simulator-workspace.integration.test.ts`, which is
opt-in with `SIMULATOR_TEST_DATABASE=1` and refuses any database except a local
loopback database named `simulator_test`. Normal `npm test` skips this real-database
test; it must be run separately against a disposable migrated database.

## Honest limitations (v1, per PLAN §12)

### Finance hardening release

- Migration `20261018160000_ai_budget` adds persistent monthly AI budget accounting,
  unique collection-evidence links, approval/measurement metadata and an offer's
  originating market ID. Unknown scorecard values become nullable. Existing data
  is not deleted; apply the migration before starting the updated backend.
- Mandates are shop/tenant-scoped, owner/admin editable, and versioned by inserting
  a new row. Old global policies remain historical; shops without scoped policies
  receive code defaults. Review desired mandates after deployment. Demo reset
  copies the source shop's active mandates without changing the source.
- Budget admission reserves estimated maximum costs before a provider request,
  including one repair retry. Accounting includes invalid responses and retains
  conservative charges when usage is unknown. Database failures stop paid calls.
  A process crash can retain a reservation until reviewed; this application estimate
  is not a substitute for provider billing limits or current pricing configuration.
- Owner/admin approval does not move money. Collection completion links an existing
  real debt payment recorded after approval; each payment can be credited only once.
  Gross collections are not incremental profit. Unsupported action outcomes stay pending.
- Capital approval freezes the preceding 30-day profit baseline. After 30 more days,
  measurement records observed shop-level change, not causal attribution; overlapping
  observations are not summed as agent profit. Legacy approvals without a baseline
  cannot be measured retrospectively by this endpoint.
- Returns and matched benchmark alpha are not manufactured from application amounts,
  projections or arbitrary profit percentages. Pending values remain null. Sandbox
  collections cannot exceed debt outstanding and are labeled as simulated.
- AI input redaction covers identifying field names and common email/phone patterns;
  arbitrary personal details in free text are not guaranteed to be detected. Use
  synthetic demo data and never paste secrets into notes sent for AI extraction.

Simulated market only — no real lender is contacted and no real money moves;
all executions are owner-approved. Payables are not tracked by the existing
schema, so DPO reads 0 until supplier balances exist. COGS falls back to a 70%
estimate only for checkout items whose lot was deleted (surfaced through
`dataCompleteness`, and matching refuses to guess below 60% completeness).
Forecast MAPE is shown even when poor — that is deliberate.
