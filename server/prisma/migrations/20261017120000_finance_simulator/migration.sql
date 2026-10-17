-- Finance Copilot "Live Business Stream" simulator: additive migration only.
-- Adds one new enum value and nullable/defaulted columns so simulated demo
-- data (POST /finance/simulator/fast-forward) can be told apart from real
-- bookkeeping and wiped cleanly (POST /finance/simulator/reset). No existing
-- column, table or constraint is altered.

ALTER TYPE "CashTransactionSource" ADD VALUE IF NOT EXISTS 'SIMULATOR';

ALTER TABLE "checkouts" ADD COLUMN "isSimulated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "checkouts" ADD COLUMN "simulationRunID" TEXT;
CREATE INDEX "checkouts_shopID_isSimulated_idx" ON "checkouts"("shopID", "isSimulated");

ALTER TABLE "debt" ADD COLUMN "isSimulated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "debt" ADD COLUMN "simulationRunID" TEXT;

ALTER TABLE "DebtPayments" ADD COLUMN "isSimulated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DebtPayments" ADD COLUMN "simulationRunID" TEXT;
CREATE INDEX "DebtPayments_isSimulated_idx" ON "DebtPayments"("isSimulated");

ALTER TABLE "expense_item" ADD COLUMN "isSimulated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "expense_item" ADD COLUMN "simulationRunID" TEXT;
CREATE INDEX "expense_item_isSimulated_idx" ON "expense_item"("isSimulated");

ALTER TABLE "cash_transactions" ADD COLUMN "isSimulated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cash_transactions" ADD COLUMN "simulationRunID" TEXT;
CREATE INDEX "cash_transactions_isSimulated_idx" ON "cash_transactions"("isSimulated");

ALTER TABLE "cash_alerts" ADD COLUMN "isSimulated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cash_alerts" ADD COLUMN "simulationRunID" TEXT;

ALTER TABLE "treasury_actions" ADD COLUMN "isSimulated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "treasury_actions" ADD COLUMN "simulationRunID" TEXT;

ALTER TABLE "insights" ADD COLUMN "isSimulated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "insights" ADD COLUMN "simulationRunID" TEXT;

ALTER TABLE "ai_decisions" ADD COLUMN "isSimulated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ai_decisions" ADD COLUMN "simulationRunID" TEXT;

ALTER TABLE "financing_offers" ADD COLUMN "isSimulated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "financing_offers" ADD COLUMN "simulationRunID" TEXT;
