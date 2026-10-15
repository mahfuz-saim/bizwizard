-- AlterTable
ALTER TABLE "draft_orders" ADD COLUMN     "buyerId" TEXT;

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AddForeignKey
ALTER TABLE "draft_orders" ADD CONSTRAINT "draft_orders_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "buyer"("userID") ON DELETE SET NULL ON UPDATE CASCADE;
