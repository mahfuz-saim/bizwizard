/*
  Warnings:

  - You are about to drop the column `tenantID` on the `referral_rewards` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "referral_rewards" DROP CONSTRAINT "referral_rewards_tenantID_fkey";

-- DropIndex
DROP INDEX "referral_rewards_tenantID_idx";

-- AlterTable
ALTER TABLE "referral_rewards" DROP COLUMN "tenantID",
ADD COLUMN     "referredTenantId" TEXT,
ADD COLUMN     "referrerTenantId" TEXT;

-- CreateIndex
CREATE INDEX "referral_rewards_referrerTenantId_id_idx" ON "referral_rewards"("referrerTenantId", "id");

-- CreateIndex
CREATE INDEX "referral_rewards_referredTenantId_id_idx" ON "referral_rewards"("referredTenantId", "id");

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referrerTenantId_fkey" FOREIGN KEY ("referrerTenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referredTenantId_fkey" FOREIGN KEY ("referredTenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
