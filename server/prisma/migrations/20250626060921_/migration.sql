/*
  Warnings:

  - Added the required column `buyPrice` to the `lot_adjustments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "lot_adjustments" ADD COLUMN     "buyPrice" DOUBLE PRECISION NOT NULL;
