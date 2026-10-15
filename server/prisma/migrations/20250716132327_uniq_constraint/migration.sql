/*
  Warnings:

  - A unique constraint covering the columns `[shopID,variantCode]` on the table `shop_variants` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateIndex
CREATE UNIQUE INDEX "shop_variants_shopID_variantCode_key" ON "shop_variants"("shopID", "variantCode");
