-- AlterEnum
ALTER TYPE "ProductCategory" ADD VALUE 'MEDICINE';

-- DropForeignKey
ALTER TABLE "referral_chain_promises" DROP CONSTRAINT "referral_chain_promises_fulfilledByReferralId_fkey";

-- DropForeignKey
ALTER TABLE "referral_rewards" DROP CONSTRAINT "referral_rewards_referralId_fkey";

-- DropIndex
DROP INDEX "referral_rewards_referralId_key";

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
