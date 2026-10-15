-- DropForeignKey
ALTER TABLE "owner" DROP CONSTRAINT "owner_referralId_fkey";

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "owner" ALTER COLUMN "referralId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "owner" ADD CONSTRAINT "owner_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
