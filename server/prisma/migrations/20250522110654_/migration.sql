/*
  Warnings:

  - Added the required column `productAmountId` to the `lot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "lot" ADD COLUMN     "productAmountId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "lot" ADD CONSTRAINT "lot_productAmountId_fkey" FOREIGN KEY ("productAmountId") REFERENCES "product_amounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
