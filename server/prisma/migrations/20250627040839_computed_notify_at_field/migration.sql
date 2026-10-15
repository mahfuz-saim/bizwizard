-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "shop_variants" ADD COLUMN     "notifyAt" TIMESTAMP(3);
