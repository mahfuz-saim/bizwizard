/*
  Warnings:

  - You are about to drop the column `locationAtStore` on the `product_amounts` table. All the data in the column will be lost.
  - You are about to drop the column `note` on the `product_amounts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "lot" ADD COLUMN     "locationAtStore" TEXT,
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "product_amounts" DROP COLUMN "locationAtStore",
DROP COLUMN "note",
ADD COLUMN     "totalProducts" INTEGER NOT NULL DEFAULT 0;
