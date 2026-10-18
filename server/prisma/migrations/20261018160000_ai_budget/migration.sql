-- AlterTable
ALTER TABLE "financing_offers" ADD COLUMN     "marketID" TEXT;

-- AlterTable
ALTER TABLE "treasury_actions" ADD COLUMN     "approvedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "capital_decisions" ADD COLUMN     "measurement" JSONB;

-- AlterTable
ALTER TABLE "agent_performance" ALTER COLUMN "realizedImpactSum" DROP NOT NULL,
ALTER COLUMN "realizedImpactSum" DROP DEFAULT,
ALTER COLUMN "benchmarkImpact" DROP NOT NULL,
ALTER COLUMN "benchmarkImpact" DROP DEFAULT,
ALTER COLUMN "alpha" DROP NOT NULL,
ALTER COLUMN "alpha" DROP DEFAULT,
ALTER COLUMN "score" DROP NOT NULL,
ALTER COLUMN "score" DROP DEFAULT;

-- CreateTable
CREATE TABLE "treasury_action_evidence" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "actionID" TEXT NOT NULL,
    "paymentID" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treasury_action_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_budget_months" (
    "tenantID" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "spentUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reservedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_budget_months_pkey" PRIMARY KEY ("tenantID","periodStart")
);

-- CreateIndex
CREATE UNIQUE INDEX "treasury_action_evidence_paymentID_key" ON "treasury_action_evidence"("paymentID");

-- CreateIndex
CREATE INDEX "treasury_action_evidence_tenantID_shopID_actionID_idx" ON "treasury_action_evidence"("tenantID", "shopID", "actionID");
