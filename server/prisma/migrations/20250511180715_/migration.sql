/*
  Warnings:

  - You are about to drop the column `Retail` on the `product_amounts` table. All the data in the column will be lost.
  - You are about to drop the column `ntoe` on the `product_amounts` table. All the data in the column will be lost.
  - Added the required column `retail` to the `product_amounts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sellPrice` to the `product_amounts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "product_amounts" DROP COLUMN "Retail",
DROP COLUMN "ntoe",
ADD COLUMN     "note" TEXT,
ADD COLUMN     "retail" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "sellPrice" DOUBLE PRECISION NOT NULL;
