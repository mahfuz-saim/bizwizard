/*
  Warnings:

  - You are about to drop the column `ReferralCode` on the `owner` table. All the data in the column will be lost.
  - You are about to drop the column `ReferralCode` on the `sales_representative` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[referralId]` on the table `owner` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `referralId` to the `owner` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReferralCodeOwnerType" AS ENUM ('OWNER', 'SALES_REPRESENTATIVE');

-- DropForeignKey
ALTER TABLE "owner" DROP CONSTRAINT "owner_ReferralCode_fkey";

-- DropIndex
DROP INDEX "sales_representative_ReferralCode_key";

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "owner" DROP COLUMN "ReferralCode",
ADD COLUMN     "referralId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "sales_representative" DROP COLUMN "ReferralCode";

-- CreateTable
CREATE TABLE "referral_code" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userType" "ReferralCodeOwnerType" NOT NULL,
    "ownerId" TEXT,
    "salesRepresentativeId" TEXT,

    CONSTRAINT "referral_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_code_code_key" ON "referral_code"("code");

-- CreateIndex
CREATE UNIQUE INDEX "referral_code_ownerId_key" ON "referral_code"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "referral_code_salesRepresentativeId_key" ON "referral_code"("salesRepresentativeId");

-- CreateIndex
CREATE UNIQUE INDEX "owner_referralId_key" ON "owner"("referralId");

-- AddForeignKey
ALTER TABLE "owner" ADD CONSTRAINT "owner_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_code" ADD CONSTRAINT "referral_code_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owner"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_code" ADD CONSTRAINT "referral_code_salesRepresentativeId_fkey" FOREIGN KEY ("salesRepresentativeId") REFERENCES "sales_representative"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "referral_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
