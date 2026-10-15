-- DropForeignKey
ALTER TABLE "credit_topup" DROP CONSTRAINT "credit_topup_handledById_fkey";

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AddForeignKey
ALTER TABLE "credit_topup" ADD CONSTRAINT "credit_topup_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "admins"("userID") ON DELETE SET NULL ON UPDATE CASCADE;
