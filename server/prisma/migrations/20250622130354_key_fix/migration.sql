-- DropForeignKey
ALTER TABLE "debt" DROP CONSTRAINT "debt_buyerID_fkey";

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AddForeignKey
ALTER TABLE "debt" ADD CONSTRAINT "debt_buyerID_fkey" FOREIGN KEY ("buyerID") REFERENCES "buyer"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;
