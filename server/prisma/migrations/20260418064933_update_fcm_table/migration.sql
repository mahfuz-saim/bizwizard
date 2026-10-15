/*
  Warnings:

  - You are about to drop the column `tenantID` on the `fcm_tokens` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "fcm_tokens" DROP CONSTRAINT "fcm_tokens_tenantID_fkey";

-- DropIndex
DROP INDEX "fcm_tokens_tenantID_idx";

-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "fcm_tokens" DROP COLUMN "tenantID",
ADD COLUMN     "tenantIds" TEXT[],
ALTER COLUMN "userId" DROP NOT NULL;
