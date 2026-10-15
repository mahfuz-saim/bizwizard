/*
  Warnings:

  - You are about to alter the column `rate` on the `CreditConversionRate` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,4)` to `DoublePrecision`.

*/
-- AlterTable
ALTER TABLE "CreditConversionRate" ALTER COLUMN "rate" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');
