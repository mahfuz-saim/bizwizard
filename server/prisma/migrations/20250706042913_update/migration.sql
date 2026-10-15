/*
  Warnings:

  - You are about to drop the column `active` on the `CreditConversionRate` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[currencyCode,isActive]` on the table `CreditConversionRate` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "CreditConversionRate_currencyCode_active_key";

-- AlterTable
ALTER TABLE "CreditConversionRate" DROP COLUMN "active",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateIndex
CREATE UNIQUE INDEX "CreditConversionRate_currencyCode_isActive_key" ON "CreditConversionRate"("currencyCode", "isActive");
