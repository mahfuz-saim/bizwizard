/*
  Warnings:

  - You are about to drop the column `monthYear` on the `attendance` table. All the data in the column will be lost.
  - You are about to drop the column `monthYear` on the `expense` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[shopID,year,month]` on the table `expense` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "attendance_monthYear_idx";

-- DropIndex
DROP INDEX "expense_shopID_monthYear_key";

-- AlterTable
ALTER TABLE "attendance" DROP COLUMN "monthYear",
ADD COLUMN     "month" INTEGER NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE),
ADD COLUMN     "year" INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);

-- AlterTable
ALTER TABLE "expense" DROP COLUMN "monthYear",
ADD COLUMN     "month" INTEGER NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE),
ADD COLUMN     "year" INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);

-- CreateIndex
CREATE INDEX "attendance_year_month_idx" ON "attendance"("year", "month");

-- CreateIndex
CREATE INDEX "expense_year_month_idx" ON "expense"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "expense_shopID_year_month_key" ON "expense"("shopID", "year", "month");
