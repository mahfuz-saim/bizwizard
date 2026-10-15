-- SR referral chain — additive, null-safe migration
--
-- - Drops the unique constraint on `referral_rewards.referralId` and makes the column nullable.
--   The chain-bonus reward row uses the new unique column `chainBonusReferralId` instead.
-- - Adds SR-side reward pointers on `referral_rewards`.
-- - Adds the optional SR-side referred pointer on `referrals`.
-- - Adds the new enum, tables, and indexes.

-- =========================================================================
-- 1. CreateEnum
-- =========================================================================
CREATE TYPE "ReferralChainPromiseStatus" AS ENUM ('PENDING', 'FULFILLED');

-- =========================================================================
-- 2. AlterTable — referral_rewards
--    Drop the unique constraint on referralId, make the column nullable,
--    and add the SR-side pointers + chain-bonus discriminator.
-- =========================================================================
ALTER TABLE "referral_rewards" DROP CONSTRAINT IF EXISTS "referral_rewards_referralId_key";
ALTER TABLE "referral_rewards" ALTER COLUMN "referralId" DROP NOT NULL;

ALTER TABLE "referral_rewards" ADD COLUMN "chainBonusReferralId" TEXT;
ALTER TABLE "referral_rewards" ADD COLUMN "referrerSalesRepId" TEXT;
ALTER TABLE "referral_rewards" ADD COLUMN "referredSalesRepId" TEXT;

CREATE UNIQUE INDEX "referral_rewards_chainBonusReferralId_key" ON "referral_rewards"("chainBonusReferralId");
CREATE INDEX "referral_rewards_referrerSalesRepId_idx" ON "referral_rewards"("referrerSalesRepId");
CREATE INDEX "referral_rewards_referredSalesRepId_idx" ON "referral_rewards"("referredSalesRepId");

-- =========================================================================
-- 3. AlterTable — referrals
--    Add the optional SR-side referred pointer and its index.
-- =========================================================================
ALTER TABLE "referrals" ADD COLUMN "referredSalesRepresentativeId" TEXT;

CREATE INDEX "referrals_referredSalesRepresentativeId_idx" ON "referrals"("referredSalesRepresentativeId");

-- =========================================================================
-- 4. CreateTable — referral_chain_promises
-- =========================================================================
CREATE TABLE "referral_chain_promises" (
    "id"                    TEXT NOT NULL,
    "upstreamSalesRepId"    TEXT NOT NULL,
    "downstreamSalesRepId"  TEXT NOT NULL,
    "halfAmount"            DOUBLE PRECISION NOT NULL,
    "status"                "ReferralChainPromiseStatus" NOT NULL DEFAULT 'PENDING',
    "fulfilledAt"           TIMESTAMP(3),
    "fulfilledByReferralId" TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_chain_promises_pkey" PRIMARY KEY ("id")
);

-- one upstream referrer per downstream SR (prevents double-referral of the same SR)
CREATE UNIQUE INDEX "referral_chain_promises_downstreamSalesRepId_key" ON "referral_chain_promises"("downstreamSalesRepId");
-- only one chain promise can be fulfilled by a given owner referral (race safety)
CREATE UNIQUE INDEX "referral_chain_promises_fulfilledByReferralId_key" ON "referral_chain_promises"("fulfilledByReferralId");
CREATE INDEX "referral_chain_promises_upstreamSalesRepId_status_idx" ON "referral_chain_promises"("upstreamSalesRepId", "status");

-- =========================================================================
-- 5. CreateTable — sales_rep_credit_wallets
-- =========================================================================
CREATE TABLE "sales_rep_credit_wallets" (
    "id"           TEXT NOT NULL,
    "salesRepId"   TEXT NOT NULL,
    "totalCredits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usedCredits"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_rep_credit_wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_rep_credit_wallets_salesRepId_key" ON "sales_rep_credit_wallets"("salesRepId");

-- =========================================================================
-- 6. CreateTable — sales_rep_credit_topups
-- =========================================================================
CREATE TABLE "sales_rep_credit_topups" (
    "id"         TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "walletId"   TEXT NOT NULL,
    "credits"    DOUBLE PRECISION NOT NULL,
    "reason"     TEXT,
    "refId"      TEXT,
    "addedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_rep_credit_topups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_rep_credit_topups_salesRepId_idx" ON "sales_rep_credit_topups"("salesRepId");
CREATE INDEX "sales_rep_credit_topups_walletId_idx" ON "sales_rep_credit_topups"("walletId");
CREATE INDEX "sales_rep_credit_topups_addedAt_idx" ON "sales_rep_credit_topups"("addedAt");

-- =========================================================================
-- 7. AddForeignKey
-- =========================================================================

-- referral_rewards -> referrals (chain bonus alternate inverse)
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_chainBonusReferralId_fkey"
    FOREIGN KEY ("chainBonusReferralId") REFERENCES "referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- referral_rewards -> sales_representative (referrer SR)
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referrerSalesRepId_fkey"
    FOREIGN KEY ("referrerSalesRepId") REFERENCES "sales_representative"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- referral_rewards -> sales_representative (referred SR)
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referredSalesRepId_fkey"
    FOREIGN KEY ("referredSalesRepId") REFERENCES "sales_representative"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- referrals -> sales_representative (referred SR)
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredSalesRepresentativeId_fkey"
    FOREIGN KEY ("referredSalesRepresentativeId") REFERENCES "sales_representative"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- referral_chain_promises -> sales_representative (upstream)
ALTER TABLE "referral_chain_promises" ADD CONSTRAINT "referral_chain_promises_upstreamSalesRepId_fkey"
    FOREIGN KEY ("upstreamSalesRepId") REFERENCES "sales_representative"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- referral_chain_promises -> sales_representative (downstream)
ALTER TABLE "referral_chain_promises" ADD CONSTRAINT "referral_chain_promises_downstreamSalesRepId_fkey"
    FOREIGN KEY ("downstreamSalesRepId") REFERENCES "sales_representative"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- referral_chain_promises -> referrals (fulfilled by)
ALTER TABLE "referral_chain_promises" ADD CONSTRAINT "referral_chain_promises_fulfilledByReferralId_fkey"
    FOREIGN KEY ("fulfilledByReferralId") REFERENCES "referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- sales_rep_credit_wallets -> sales_representative
ALTER TABLE "sales_rep_credit_wallets" ADD CONSTRAINT "sales_rep_credit_wallets_salesRepId_fkey"
    FOREIGN KEY ("salesRepId") REFERENCES "sales_representative"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- sales_rep_credit_topups -> sales_representative
ALTER TABLE "sales_rep_credit_topups" ADD CONSTRAINT "sales_rep_credit_topups_salesRepId_fkey"
    FOREIGN KEY ("salesRepId") REFERENCES "sales_representative"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- sales_rep_credit_topups -> sales_rep_credit_wallets
ALTER TABLE "sales_rep_credit_topups" ADD CONSTRAINT "sales_rep_credit_topups_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "sales_rep_credit_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
