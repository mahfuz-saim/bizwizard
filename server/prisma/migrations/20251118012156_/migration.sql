/*
  Warnings:

  - You are about to drop the column `documentImageURL` on the `KYC` table. All the data in the column will be lost.
  - Added the required column `documentFileType` to the `KYC` table without a default value. This is not possible if the table is not empty.
  - Added the required column `documentURL` to the `KYC` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "KYC" DROP COLUMN "documentImageURL",
ADD COLUMN     "documentFileType" TEXT NOT NULL,
ADD COLUMN     "documentURL" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');
