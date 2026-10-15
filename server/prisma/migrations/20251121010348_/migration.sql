/*
  Warnings:

  - You are about to drop the column `documentType` on the `KycDocument` table. All the data in the column will be lost.
  - You are about to drop the column `documentUrl` on the `KycDocument` table. All the data in the column will be lost.
  - Added the required column `fileUrl` to the `KycDocument` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "KycDocument" DROP COLUMN "documentType",
DROP COLUMN "documentUrl",
ADD COLUMN     "fileUrl" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');
