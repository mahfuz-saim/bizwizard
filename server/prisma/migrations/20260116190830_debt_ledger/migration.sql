-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DEBT_CREATED', 'PAYMENT_SINGLE', 'PAYMENT_BULK');

-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateTable
CREATE TABLE "buyer_debt_ledger" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "previousBalance" DOUBLE PRECISION NOT NULL,
    "newBalance" DOUBLE PRECISION NOT NULL,
    "debtId" TEXT,
    "checkoutId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_debt_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "buyer_debt_ledger_shopId_buyerId_createdAt_idx" ON "buyer_debt_ledger"("shopId", "buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "buyer_debt_ledger_buyerId_createdAt_idx" ON "buyer_debt_ledger"("buyerId", "createdAt");
