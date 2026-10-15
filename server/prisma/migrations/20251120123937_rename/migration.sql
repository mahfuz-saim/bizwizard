/*
  Warnings:

  - You are about to drop the column `documentURL` on the `KycDocument` table. All the data in the column will be lost.
  - Added the required column `documentUrl` to the `KycDocument` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "KycDocument" DROP COLUMN "documentURL",
ADD COLUMN     "documentUrl" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');
