/*
  Warnings:

  - A unique constraint covering the columns `[shopID,monthYear]` on the table `expense` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateIndex
CREATE UNIQUE INDEX "expense_shopID_monthYear_key" ON "expense"("shopID", "monthYear");
