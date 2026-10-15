-- DropForeignKey
ALTER TABLE "checkouts" DROP CONSTRAINT "checkouts_buyerID_fkey";

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AddForeignKey
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_buyerID_fkey" FOREIGN KEY ("buyerID") REFERENCES "buyer"("userID") ON DELETE SET NULL ON UPDATE CASCADE;
