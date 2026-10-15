/*
  Warnings:

  - You are about to drop the column `genericeName` on the `inventory` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "inventory" DROP COLUMN "genericeName",
ADD COLUMN     "genericName" TEXT;
