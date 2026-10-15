-- DropForeignKey
ALTER TABLE "checkout_items" DROP CONSTRAINT "checkout_items_checkoutID_fkey";

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AddForeignKey
ALTER TABLE "checkout_items" ADD CONSTRAINT "checkout_items_checkoutID_fkey" FOREIGN KEY ("checkoutID") REFERENCES "checkouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
