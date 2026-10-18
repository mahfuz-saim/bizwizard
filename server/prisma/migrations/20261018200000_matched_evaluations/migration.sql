-- CreateTable
CREATE TABLE "finance_evaluations" (
    "id" TEXT NOT NULL,
    "tenantID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREPARED',
    "snapshot" JSONB NOT NULL,
    "choices" JSONB,
    "outcome" JSONB,
    "model" TEXT,
    "usedFallback" BOOLEAN,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "failure" TEXT,
    "choicesFrozenAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "finance_evaluations_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "finance_evaluations_tenantID_shopID_createdAt_idx" ON "finance_evaluations"("tenantID", "shopID", "createdAt");
-- CreateIndex
CREATE UNIQUE INDEX "finance_evaluations_tenantID_shopID_inputHash_key" ON "finance_evaluations"("tenantID", "shopID", "inputHash");
