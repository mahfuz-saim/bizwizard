-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('CREDITS', 'SUBSCRIPTION_EXTENSION');

-- CreateEnum
CREATE TYPE "RewardClaimStatus" AS ENUM ('PENDING', 'CLAIMED', 'REVOKED');

-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "credit_usages" ALTER COLUMN "creditsUsed" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "credit_wallets" ALTER COLUMN "totalCredits" SET DEFAULT 0,
ALTER COLUMN "totalCredits" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "usedCredits" SET DEFAULT 0,
ALTER COLUMN "usedCredits" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateTable
CREATE TABLE "referral_rewards" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "referrerStatus" "RewardClaimStatus" NOT NULL DEFAULT 'PENDING',
    "referrerRewardType" "RewardType",
    "referrerCredits" DOUBLE PRECISION DEFAULT 100,
    "referrerSubDays" INTEGER DEFAULT 7,
    "referrerClaimedAt" TIMESTAMP(3),
    "referrerShopId" TEXT,
    "referredStatus" "RewardClaimStatus" NOT NULL DEFAULT 'PENDING',
    "referredRewardType" "RewardType",
    "referredCredits" DOUBLE PRECISION DEFAULT 100,
    "referredSubDays" INTEGER DEFAULT 7,
    "referredClaimedAt" TIMESTAMP(3),
    "referredShopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_rewards_referralId_key" ON "referral_rewards"("referralId");

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referrerShopId_fkey" FOREIGN KEY ("referrerShopId") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referredShopId_fkey" FOREIGN KEY ("referredShopId") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;
