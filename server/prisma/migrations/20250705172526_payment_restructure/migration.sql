/*
  Warnings:

  - You are about to drop the `credit_log` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `credit_topup` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `usage_type` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'TRIAL');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('MESSAGE', 'STORAGE', 'API_CALL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('SUBSCRIPTION', 'CREDIT', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE 'FAILED';
ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELED';

-- DropForeignKey
ALTER TABLE "credit_log" DROP CONSTRAINT "credit_log_shopId_fkey";

-- DropForeignKey
ALTER TABLE "credit_log" DROP CONSTRAINT "credit_log_usageTypeId_fkey";

-- DropForeignKey
ALTER TABLE "credit_topup" DROP CONSTRAINT "credit_topup_handledById_fkey";

-- DropForeignKey
ALTER TABLE "credit_topup" DROP CONSTRAINT "credit_topup_requestedById_fkey";

-- DropForeignKey
ALTER TABLE "credit_topup" DROP CONSTRAINT "credit_topup_shopId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_userId_fkey";

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- DropTable
DROP TABLE "credit_log";

-- DropTable
DROP TABLE "credit_topup";

-- DropTable
DROP TABLE "payments";

-- DropTable
DROP TABLE "usage_type";

-- DropEnum
DROP TYPE "LogType";

-- DropEnum
DROP TYPE "TopUpStatus";

-- CreateTable
CREATE TABLE "shop_payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0.00,
    "transactionId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentGatewayData" JSONB,
    "validationId" TEXT,
    "paymentType" "PaymentType" NOT NULL,
    "subscriptionId" TEXT,
    "creditTopupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "months" INTEGER NOT NULL,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "discount" DOUBLE PRECISION DEFAULT 0.00,
    "discountedPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "subscriptionPlanId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_wallets" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "totalCredits" INTEGER NOT NULL DEFAULT 0,
    "usedCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_topups" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "paymentId" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_topups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_usages" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "description" TEXT,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shop_payments_transactionId_key" ON "shop_payments"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "shop_payments_validationId_key" ON "shop_payments"("validationId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_paymentId_key" ON "Subscription"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_wallets_shopId_key" ON "credit_wallets"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_topups_paymentId_key" ON "credit_topups"("paymentId");

-- AddForeignKey
ALTER TABLE "shop_payments" ADD CONSTRAINT "shop_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "owner"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_payments" ADD CONSTRAINT "shop_payments_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "shop_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_topups" ADD CONSTRAINT "credit_topups_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_topups" ADD CONSTRAINT "credit_topups_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "credit_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_topups" ADD CONSTRAINT "credit_topups_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "shop_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_usages" ADD CONSTRAINT "credit_usages_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_usages" ADD CONSTRAINT "credit_usages_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "credit_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
