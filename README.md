# BizWizard

BizWizard helps small businesses manage stock, sales, cash flow, and financing
decisions. Built for the FinTechathon SME Finance Copilot topic.

**Financing is simulated:** no real lender is contacted, and no loan or bank transfer happens.

- Application: [bizwizard-lake.vercel.app](https://bizwizard-lake.vercel.app/)
- Private repositories require an invitation for reviewers to access source code.

## Main features

- **Daily business:** track stock, sales, customers, purchases, expenses, and money owed.
- **Financing:** compare eligible offers, check affordability, and review repayment plans.
- **Cash flow:** track cash, upcoming payments, forecasts, and alerts.
- **Business insights:** review product profits, spot unusual activity, and test what-if scenarios.
- **AI assistance:** explain options, keep decision records, and compare AI with rules in simulations.

```mermaid
flowchart TD
  Web[Web app · Next.js] --> API[Backend · Express]
  API --> DB[(Database · PostgreSQL)]
  API --> Finance[Financial calculations and checks]
  Finance --> AI[Optional AI assistance · OpenAI]
```

Code handles the financial calculations; AI helps select or explain options.
AI cannot bypass checks or required approvals. If AI is unavailable, the app uses
rules instead and labels the result.

## Requirements

- Node.js 24 (includes npm) and Git.
- PostgreSQL for the full application or **Run 2**. Setup is explained below.
- An OpenAI API key only if you choose the paid `--live` benchmark.

## Quick start: try the tests first

Install [Node.js 24](https://nodejs.org/en/download/) and
[Git](https://git-scm.com/install/) if needed. On each download page, choose your OS.

Open a terminal and clone the project:

```sh
git clone https://github.com/mahfuz-saim/bizwizard
cd bizwizard
```

Use **clone**, not Download ZIP: evidence reports need the Git history.
Open the cloned folder in VS Code and choose **Terminal → New Terminal**.
Use PowerShell on Windows, or Terminal on Linux/macOS. The `node` and `npm`
commands work on all three.

Check that Node.js and npm are installed:

```powershell
node --version
npm --version
```

Node should show `v24.x.x`. After installing Node or Git, open a new terminal.

For the quickest test, run this from the project folder:

```powershell
cd server
npm ci
npm run benchmark:finance
```

This runs the **sample AI-versus-rules comparison**. It needs no database, API key,
VPS, or running website. It checks the comparison logic, not a real AI provider.

Next, choose what you need:

- **Test the backend with a real database:** follow [Run 2](#run-2-application-execution-evidence).
- **Use the application on your computer:** follow [Run the application locally](#run-the-application-locally).
- **Call a real AI provider:** follow the optional paid steps in [Run 1](#run-1-ai-versus-rules-benchmark).

## Run the application locally

Use the cloned repository from Quick start. Open two terminals in its root.
Install PostgreSQL and open its SQL console as explained in
[Run 2, steps 1–2](#run-2-application-execution-evidence). For the application,
create a database named `bizwizard` instead:

```sql
CREATE DATABASE bizwizard;
```

Backend, in PowerShell:

```powershell
cd server
npm ci
Copy-Item .env.example .env
```

On Linux/macOS, use `cp .env.example .env` instead of `Copy-Item`.

Edit `server/.env` locally. Replace its `DATABASE_URL` line with:

```dotenv
DATABASE_URL=postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@127.0.0.1:5432/bizwizard?schema=public
```

Use `postgres` as the user on Windows/Linux, or your macOS username. Replace the
password with the one set in PostgreSQL. Special characters must be URL-encoded
(for example, `@` becomes `%40`, `#` becomes `%23`, and `%` becomes `%25`).

Generate two different login secrets with this command (works on all three OSes):

```sh
node -e "const c = require('node:crypto'); console.log('JWT_SECRET=' + c.randomBytes(48).toString('hex')); console.log('REFRESH_SECRET=' + c.randomBytes(48).toString('hex'))"
```

Copy the two output lines into `.env`, replacing its empty `JWT_SECRET` and
`REFRESH_SECRET` lines. Do not share them.

Keep the remaining setup simple:

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
The seed skips existing accounts. `--refresh` rebuilds generated history while
preserving added activity and its inventory links. Linked payments can block a
refresh. Do not refresh or seed production as a deployment step.

Frontend, in a second terminal:

```powershell
cd client
npm ci
Copy-Item .env.example .env.local
npm run dev
```

On Linux/macOS, use `cp .env.example .env.local` instead of `Copy-Item`.

Open `http://localhost:3000`. The client example points to
`http://localhost:5000/api/v1`; requests go through Next's same-origin proxy.
Register a local account to sign in, or use the sample accounts listed in
`server/prisma/seed/transaction-data.ts` if you ran the seed.

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

**Free sample run** — from `server`, after `npm ci`. No database or API key needed:

```powershell
npm run benchmark:finance
```

**Optional paid AI run** — create `server/.env.benchmark` (ignored by Git):

```dotenv
OPENAI_API_KEY=your-own-key
BENCHMARK_BUDGET_USD=0.10
```

```powershell
npm run benchmark:finance -- --live
```

**Results:** the terminal shows the comparison; `benchmark-results.json` is saved
in a new folder under `evidence/runs/`. Paid runs also record AI usage and estimated cost.

**Keep in mind:** the free run uses fixed sample choices, not real AI. Both modes
use synthetic cases—not the full application workflow or proof of real-world gains.
AI can lose. The paid limit is an estimate, not a billing guarantee; set a provider
spending limit too. Never commit your API key.

## Run 2: application execution evidence

**What it does:** tests the real backend using sample data in a local test database.
It creates its own test data and saves JSON reports. You do not need to download
our database, start the website, or provide an API key.

### 1. Install PostgreSQL once

Already have PostgreSQL running on port `5432`? Skip to step 2.

<details>
<summary>Windows</summary>

1. Open the [official PostgreSQL Windows download page](https://www.postgresql.org/download/windows/?r=prd-ffs)
   and follow its **Download the installer** link.
2. Install PostgreSQL 18. Keep **PostgreSQL Server** and **Command Line Tools** selected.
3. Set a password for the database user `postgres`. Remember it for step 3.
4. Keep the port as **5432** and finish the installation. You can skip Stack Builder;
   no extra packages are needed for these tests.

</details>

<details>
<summary>Linux (Ubuntu/Debian)</summary>

```bash
sudo apt update
sudo apt install postgresql postgresql-client
sudo systemctl start postgresql
```

For other distributions, use the packages linked from
[PostgreSQL Downloads](https://www.postgresql.org/download/).

</details>

<details>
<summary>macOS (Homebrew)</summary>

If `brew --version` fails, follow the
[Homebrew installation steps](https://docs.brew.sh/Installation), including the
installer's **Next steps**, then reopen Terminal. Once `brew --version` works, run:

```bash
brew install postgresql@18
brew services start postgresql@18
export PATH="$(brew --prefix postgresql@18)/bin:$PATH"
```

Keep this terminal open for the next steps. See the
[Homebrew package](https://formulae.brew.sh/formula/postgresql%4018) for details.

</details>

The evidence runner does **not** install or start PostgreSQL for you.

### 2. Create an empty test database once

Open the SQL console for your system:

- **Windows:** open **SQL Shell (psql)** from Start. Accept the defaults, then enter
  your installation password. Your database user is `postgres`.
- **Linux:** run `sudo -u postgres psql`. Type `\password postgres` to set a local
  database password. Your database user is `postgres`.
- **macOS:** run `psql -d postgres`. Type `\password` to set a database password.
  Your database user is your macOS username (`whoami` in Terminal).

At the SQL prompt, run:

```sql
CREATE DATABASE simulator_test;
\q
```

You should see `CREATE DATABASE` before the shell closes.
If it says the database already exists, continue—do not delete it.

### 3. Run the tests

Starting in the project folder, run these commands on any OS:

```powershell
cd server
npm ci
npm run prisma:generate
```

Already completed these setup commands? Skip them. Choose your shell below and
enter your **local database password**, not a VPS password. Input is hidden.

<details>
<summary>Windows (PowerShell)</summary>

```powershell
$dbLogin = Get-Credential -UserName postgres -Message 'Enter your local PostgreSQL password'
$dbPassword = [uri]::EscapeDataString($dbLogin.GetNetworkCredential().Password)
$env:EVIDENCE_DATABASE_URL = "postgresql://postgres:${dbPassword}@127.0.0.1:5432/simulator_test"
npm run evidence:finance
Remove-Item Env:EVIDENCE_DATABASE_URL
Remove-Variable dbLogin, dbPassword
```

</details>

<details>
<summary>Linux/macOS (Bash)</summary>

Run `bash` first if your terminal uses another shell, then paste:

```bash
read -r -p 'Database user (postgres on Linux; your username on macOS): ' DB_USER
read -r -s -p 'Local database password: ' DB_PASSWORD
printf '\n'
export DB_USER DB_PASSWORD
export EVIDENCE_DATABASE_URL="$(node -e 'console.log(`postgresql://${encodeURIComponent(process.env.DB_USER)}:${encodeURIComponent(process.env.DB_PASSWORD)}@127.0.0.1:5432/simulator_test`)')"
npm run evidence:finance
unset EVIDENCE_DATABASE_URL DB_USER DB_PASSWORD
```

</details>

### 4. Check the result

All six steps should show **PASS**: database migrations, then five test suites.
The terminal prints the report location under `evidence/runs/` in the project root.
Open `sandbox-operation-logs.json` in that run's folder: `success` should be `true`.
A failed or skipped test is not a successful evidence run.

The tests cover cash updates, stock purchases, alerts, permissions, approvals,
financing, simulations, and saved AI-versus-rules evaluations. They test backend
code, not browser screens or a demo video. No Cloudinary or Firebase setup is needed.

**Data safety:** only use a local test database. The runner accepts `127.0.0.1`
and `simulator_test`, creates a new schema (a separate set of tables) each time,
and applies migrations itself. It does not erase existing tables. Test schemas
remain available for inspection after the run.

**If it fails:**

- **Cannot connect:** start PostgreSQL (Windows **Services**, or the Linux/macOS
  command in step 1). Check that it uses port `5432`.
- **Wrong password:** rerun step 3 using the password set during PostgreSQL installation.
- **Missing database:** repeat step 2. The name must be exactly `simulator_test`.
- **Still failing:** keep the printed PASS/FAIL summary and check the JSON report
  if one was created. Do not share passwords or connection strings.

## AI vs rules: test your shop

As a shop owner, open **AI Agent Ledger → Run matched sandbox evaluation**.
It compares AI and rules using the same shop data and simulated conditions.
Your real stock, sales, and cash stay unchanged.

- **Before running:** at least 60% sales-history coverage and 14 days of cash history
  are needed. Run financing matching first to include loan comparisons.
- **Missing data:** parts of the test may stay pending; the screen explains why.
- **No AI key or budget:** results are labelled as rules-based, not live AI.
- **Results:** these are simulations, not proof of real-world gains. AI can lose.

**Repeat a saved result:** download its JSON from the screen, then run this from
`server` (with dependencies installed). No database or API key is needed:

```powershell
npm run evidence:finance -- --replay PATH_TO_EXPORTED_EVALUATION.json
```

Replace `PATH_TO_EXPORTED_EVALUATION.json` with your downloaded file's path
(use quotes if it contains spaces). The command checks whether the saved result
can be reproduced; a mismatch fails verification.

## Evidence files

Results appear in the terminal and are saved as JSON in new folders under
`evidence/runs/`. Previous runs are not overwritten.

- **`benchmark-results.json`** — AI/rules choices, comparison results, and AI usage/cost when applicable.
- **`sandbox-operation-logs.json`** — tests run, expected vs actual results, PASS/FAIL, and timings.
- **`matched-evaluation.json`** — saved shop simulation inputs, choices, and outcomes.
- **`matched-replay-verification.json`** — whether replaying a saved simulation matched its result.

Each report includes its date and code version, plus a warning if there were
uncommitted changes. Different commands produce different files—not all four every time.

**For submission:** commit your code, rerun the tests, review the reports, and copy
the selected JSON files into `evidence/submission/`. Files in `evidence/runs/`
are not included in Git commits.

## Deployment and database changes

- **Frontend (Vercel):** choose `client` as the root and **Next.js** as the framework.
  Set `NEXT_PUBLIC_API_BASE_URL` to your backend URL ending in `/api/v1`.
- **Backend (VPS):** requires PostgreSQL, environment secrets, SSH access, and the
  deployment/backup services to be set up first. Required GitHub secrets are listed
  in `.github/workflows/backend.yml`. Never commit their values.
- **Automatic updates:** pushing backend or workflow changes to `main` runs tests,
  builds, backs up the database, applies migrations, and restarts the backend.
  Changes to the VPS deployment script itself need a separate VPS update.
- **Database:** always apply committed migrations before starting a new backend.
  Reverting code does not undo migrations.
- **Check both deployments:** frontend and backend deploy separately. Confirm both
  succeeded before testing the live site.

## Security and limitations

- **Access:** finance changes require owner/admin access. Employees can only read
  finance data for their assigned shop.
- **AI controls:** AI cannot bypass financial checks or required approvals.
- **Privacy:** sensitive text is not fully filtered. Use sample data for demos and
  avoid sending private information to AI.
- **Results:** simulations do not prove real-world gains. Cash collected is not profit.
- **Database:** apply committed migrations, not just `prisma db push`, so automatic
  cash updates work. This app is not a full accounting or bank-reconciliation system.
