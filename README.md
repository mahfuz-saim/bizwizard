# BizWizard

An SME inventory and sales platform with financing-option matching, cash-flow alerts,
financial analysis, and bounded AI assistance. Built for the FinTechathon SME Finance
Copilot topic. The financing market is simulated: no real lender is contacted and
no loan or bank transfer is executed.

- Application: [bizwizard.sadman.app](https://bizwizard.sadman.app)
- Original repository: [mahfuz-saim/bizwizard](https://github.com/mahfuz-saim/bizwizard)
- Frontend fork: [SADMAN30102001SAKIB/bizwizard](https://github.com/SADMAN30102001SAKIB/bizwizard)
- Private repositories require an invitation for reviewers to access source code.

## What is implemented

- Stock, sales, customers, receivables, purchases, expenses, and employee workflows.
- Deterministic financing eligibility, affordability checks, bounded negotiation,
  owner-approved applications, and repayment schedules.
- Cash ledger, dated commitments, projections, nine alert rules, and guarded plans.
- Product economics, working-capital metrics, verified anomaly hypotheses,
  scenarios, forecasts, and 30-day observed capital-outcome measurements.
- Shop-scoped mandates, decision audit export, AI usage accounting, and sandbox simulation.

```mermaid
flowchart LR
  Browser[Next.js frontend] --> Proxy[Same-origin API proxy]
  Proxy --> API[Express API and authorization]
  API --> Rules[Deterministic finance engines]
  API --> DB[(PostgreSQL / Prisma)]
  Rules --> AI[Optional bounded OpenAI decisions]
  AI --> Guards[Schema validation and financial guards]
  Guards --> DB
```

Financial arithmetic is computed in code. AI may select or explain bounded options;
it cannot override eligibility or approval gates. Missing credentials, invalid output,
budget denial, and timeouts use labelled deterministic fallbacks.

## Requirements

- Node.js 24 and npm; Git to clone and identify evidence revisions.
- PostgreSQL for the application and database evidence runner. PostgreSQL 18 was used
  for isolated verification; install a supported PostgreSQL version locally.
- The standalone benchmark does **not** need PostgreSQL, a running server, or VPS access.
- Live AI mode requires an OpenAI API key with available credit and network access.
- No new npm dependencies are required by the submission runners.

## Run the application locally

Clone the repository you have access to, then open two terminals in its root.
Create an empty local database named `bizwizard` using PostgreSQL's SQL console:

```sql
CREATE DATABASE bizwizard;
```

Backend, in PowerShell:

```powershell
cd server
npm ci
Copy-Item .env.example .env
```

Edit `server/.env` locally:

- Set `DATABASE_URL` to your local database connection string.
- Set different, long random `JWT_SECRET` and `REFRESH_SECRET` values.
- Keep `NODE_ENV=development`, `PORT=5000`, and the supplied token-expiry settings.
- OpenAI is optional; leave its key empty for deterministic operation.
- Cloudinary is needed for image/KYC uploads, not the isolated finance tests.
- Firebase credentials are needed for FCM push, not core finance calculations.
- Leave demo auto-seed variables empty unless you deliberately want that account.

Never publish `.env` contents or service-account JSON. Do not reuse production secrets.

```powershell
npm run prisma:generate
npx prisma migrate deploy
# Optional synthetic demo history; only against your local database:
npm run seed
npm run dev:node
```

The original `npm run dev` uses Bun. `dev:node` uses the installed Node.js/tsx instead.
The seed preserves existing fixture accounts by default; `--refresh` replaces their
generated history. Do not refresh or seed production as a deployment step.

Frontend, in a second terminal:

```powershell
cd client
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The client example points to
`http://localhost:5000/api/v1`; requests go through Next's same-origin proxy.
Use local registration or the synthetic accounts defined in the seed.

## Tests

From `server`:

```powershell
npm test
npm run build
npm run test:submission
```

From `client`:

```powershell
npm test
npm run test:backend-contract
npm run build
```

Normal backend tests intentionally skip five PostgreSQL integration suites.
A successful run with skipped suites is **not** database execution evidence.
Use the following runner to execute those suites with a real isolated database.

## Run 1: AI-versus-rules benchmark

From `server`, after `npm ci`, run without external services:

```powershell
npm run benchmark:finance
```

Fixture mode compares four deterministic participant policies against pinned baselines
across three fixed credit-risk cases. It verifies the mechanics, not live AI quality.
The lender fixture can lose against the baseline; results are not forced positive.

For a real provider run, create Git-ignored `server/.env.benchmark`:

```dotenv
OPENAI_API_KEY=your-own-key
BENCHMARK_BUDGET_USD=0.10
```

```powershell
npm run benchmark:finance -- --live
```

Only explicit `--live` loads that file. Live mode uses `gpt-4o-mini`, requests bounded
JSON choices, validates them, and records model, token usage, latency, and estimated
USD cost. Budget admission conservatively reserves both allowed attempts per case.
The configured limit must be greater than 0 and at most USD 1 per invocation.
Application estimates are not a provider billing guarantee; configure provider limits too.
Fallbacks and invalid choices make a live run fail rather than silently count as AI success.

Both sides receive identical synthetic inputs and constraints. The report distinguishes
expected lender returns, contracted borrowing cost, modeled collections, and simplified
capital returns. Different metrics must not be added into one profit total.
This is not a full repayment backtest or proof of causal or real-world AI superiority.
The live benchmark is a standalone policy-selection exercise, not a replay of the
application's complete multi-agent negotiation pipeline.
Live responses and costs can vary; fixture measurements are deterministic.

## Run 2: application execution evidence

Create a separate disposable database on local PostgreSQL:

```sql
CREATE DATABASE simulator_test;
```

From `server`, in PowerShell:

```powershell
$env:EVIDENCE_DATABASE_URL = 'postgresql://LOCAL_USER:LOCAL_PASSWORD@127.0.0.1:5432/simulator_test'
npm run evidence:finance
Remove-Item Env:EVIDENCE_DATABASE_URL
```

Replace the example credentials with your local ones, not VPS credentials.
The runner requires exactly `127.0.0.1` and database name `simulator_test`; it rejects
connection overrides. It creates a unique schema, applies migrations, and runs the
five integration suites sequentially. No existing schema is reset or dropped.
The database user needs permission to create schemas. Each run's schema is retained
for inspection; remove only the specifically identified test schema when finished.

Scenarios cover cash events and rollback, supplier-obligation evidence, the expense
alert, tenant/shop isolation, approval gates, budgets, matching, bounded negotiation,
applications, 30-day observations, and isolated simulator copy/run/reset behavior.
Tests invoke actual backend services and selected routes on loopback HTTP servers;
no separately started backend, Cloudinary, Firebase, or paid AI call is required.
This is backend integration evidence, not a browser test or demonstration video.

## Shop-specific matched sandbox scorecards

In **AI Agent Ledger**, owners can select **Run matched sandbox evaluation**.
The system freezes the current shop's history and mandate versions before calling AI,
then durably freezes its choices before replaying eight paired outcome paths.
Both arms share the same universe and outcome draws. Zero/negative differences remain
visible. No sales, purchases, repayments, inventory, or cash balances are changed.
These are recorded **sandbox outcomes**, not observed real-world or causal alpha.

Sales-history completeness must be at least 60%, with 14 days of cash history.
Run financing matching first for equal-principal, affordable quote comparisons;
capital evaluation needs product economics and available cash above the buffer.
Unavailable roles stay pending with a reason. AI budget denial/missing credentials
use an explicitly labelled deterministic policy, not a claimed live AI result.
Unchanged daily snapshots reuse their saved evaluation without another paid call.
New data or mandate versions create a new record; prior snapshots are not overwritten.
The screen shows the latest 20 evaluations; full records remain downloadable by ID.

Download an evaluation's frozen inputs, choices, seed, assumptions, and both outcome
ledgers. From `server`, reproduce it without PostgreSQL or an API key:

```powershell
npm run evidence:finance -- --replay PATH_TO_EXPORTED_EVALUATION.json
```

The command validates inputs and compares canonical outcome hashes; an altered result
fails verification. It proves reproducibility, not cryptographic authorship or causal
benefit. Replay uses the pinned algorithm version. Interrupted runs are retained as
failed rather than silently retried with fresh outcomes or another paid call.

## Evidence files

Both runners print aligned terminal summaries with timings and results. Colours are
TTY-only; set `NO_COLOR=1` to disable them. Full evidence remains in the JSON files.

Each runner creates a timestamped, uniquely named folder under `evidence/runs/`:

- `benchmark-results.json`: inputs, choices, constraints, measurements, usage, limitations.
- `sandbox-operation-logs.json`: commands, expected/observed numeric events, pass/fail summaries, isolation, and timings.
- `matched-evaluation.json`: a synthetic shop's frozen inputs, choices and paired ledgers.
- `matched-replay-verification.json`: offline verification of a downloaded evaluation.

Reports record the Git commit, dirty-tree status, and a hash of the tracked diff.
Uncommitted reports are development evidence, not a clean release attestation.
Reruns never overwrite previous runs. Raw provider errors, tokens, keys, database
URLs, and raw business records are not included in the scenario report.

`evidence/runs/` is ignored by Git. To preserve submission evidence, commit the
implementation first, rerun both commands, inspect the generated JSON, and copy the
chosen files into `evidence/submission/`. Preserve failures if discussing those runs.
Included development snapshots, when present, explicitly retain their dirty-tree warning.
The README is the evidence index; no separate Markdown report is required.

## Deployment and database changes

The original repository's backend workflow runs on `server/**` changes pushed to
`main`. After tests/build, it uploads the artifact through restricted SSH. The
installed deployment script installs dependencies, generates Prisma, runs a backup,
applies committed migrations with `prisma migrate deploy`, restarts the backend,
and checks readiness. Required GitHub secrets are listed in
`.github/workflows/backend.yml`; values must never be committed.

The Linux VPS must already have the restricted deployment user/key, installed
deployment script, systemd application/backup services, PostgreSQL, and shared runtime
configuration. This is not a one-command fresh-VPS installer. Deployment scripts are
not automatically replaced merely by editing their local copies.
Code rollback does not reverse a database migration; review backward compatibility.

This release adds cash-event triggers, supplier-obligation metadata and matched
evaluation storage. Apply all three new migrations **before** starting its backend. Future non-simulated sales, debt
payments, and expenses update cash atomically, including edits/deletions. Existing
history can be reconciled once through the owner-only **Backfill ledger** action.
It is safe to repeat and preserves manual entries; do not manually enter a second
cash transaction for a source event that already has an automatic entry.

Supplier obligations are explicitly recorded in Cash Flow, not guessed from previous
fully paid purchases. Check “existing unpaid supplier obligation” only for a real
recorded liability. Settle it by linking a matching same-shop recorded purchase;
this does not issue another payment. Linked evidence amounts cannot be changed or deleted.
Historical supplier liabilities remain incomplete until the owner records them.

For Vercel, select `client` as the root and Next.js as the framework, retain default
build/output settings, and set `NEXT_PUBLIC_API_BASE_URL` to the backend's `/api/v1`
address. A fork must be synchronized before its frontend deployment contains upstream
changes. Backend and frontend deployments are separate; inspect both statuses.

## Security boundaries and known limitations

- Finance mutations require owner/admin authority; employee reads are shop-scoped.
- Mandates are scoped/versioned. Financial guard checks outrank model instructions.
- AI input redaction is limited, especially for arbitrary free text; use synthetic data.
- Budget reservations may remain after a process crash. Provider billing is authoritative.
- Collections are gross cash, not incremental profit. A 30-day before/after observation
  is not causal attribution. Real scorecards remain pending without matched evidence.
- The website's synthetic comparison uses the same fixture engine as the CLI. It is
  separate from personal scorecards and does not call paid AI or alter shop records.
- Cash is attributed to the selected default account when the source has no account
  designation; this is not bank reconciliation or full double-entry accounting.
- PostgreSQL triggers are essential to cash synchronization; schema-only `db push`
  does not install them. Always apply the committed migrations.
- Source dependencies have their own licenses. Review their notices and any external
  dataset rights before submission; synthetic benchmark inputs need no customer data.

Technical/security PDFs, presentation, and video are separate submission deliverables.
Neither these scripts nor passing tests guarantee full marks or regulatory certification.

## Build the submission PDFs

Editable LaTeX sources are in `submission/technical/main.tex` and
`submission/security/main.tex`, with a shared `submission/preamble.tex` for styling
and vector diagrams. Edit these sources rather than the generated PDFs.

Install [Tectonic](https://tectonic-typesetting.github.io/book/latest/installation/)
and run from the repository root:

```powershell
.\submission\build.ps1
# Or pass the location of a portable compiler:
.\submission\build.ps1 -TectonicPath 'C:\path\to\tectonic.exe'
```

The first build downloads LaTeX packages. Both PDFs are written to `output/pdf/`;
intermediate files stay in Git-ignored `submission/.build/`. Building documents does
not run the application, call AI, or regenerate the financial evidence.

## Presentation

Open `output/presentation/BizWizard-Presentation.pptx` in PowerPoint to edit the
text, diagrams, tables and benchmark chart. Product screenshots remain images.
The deck has 12 main slides with speaker notes and three hidden technical backup
slides. Unhide slides 13–15 when needed for questions.

The JavaScript source is `submission/presentation/build.mjs`. It uses the
`@oai/artifact-tool` library supplied with the Codex presentation runtime, separate
from application dependencies. With that runtime available, run the source with
Node.js; `ARTIFACT_TOOL_MODULE` can point to the library's module file. Drafts and
previews stay in the Git-ignored `.build/` directory. Full validation also uses
`PRESENTATION_SKILL_DIR`, `RUNTIME_NODE_MODULES` and `RUNTIME_PYTHON`; set
`PRESENTATION_OUTPUT` to a new filename when generating another final version.
Direct PowerPoint edits do not require any of these tools and do not update the
JavaScript source. Screenshots use illustrative local demo responses; measured
results come from the saved submission evidence, not those screenshots.
