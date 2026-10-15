/*
  Warnings:

  - A unique constraint covering the columns `[employeeId,date]` on the table `attendence` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "attendence" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateIndex
CREATE UNIQUE INDEX "attendence_employeeId_date_key" ON "attendence"("employeeId", "date");
