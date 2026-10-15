/*
  Warnings:

  - Added the required column `dueDate` to the `note` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "note" ADD COLUMN     "dueDate" TIMESTAMP(3) NOT NULL;
