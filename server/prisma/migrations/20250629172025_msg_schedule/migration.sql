/*
  Warnings:

  - Added the required column `scheduledAt` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "scheduledAt" TIMESTAMP(3) NOT NULL;
