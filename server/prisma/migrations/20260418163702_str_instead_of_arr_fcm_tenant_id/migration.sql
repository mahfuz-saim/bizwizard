/*
  Warnings:

  - You are about to drop the column `tenantIds` on the `fcm_tokens` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "fcm_tokens" DROP COLUMN "tenantIds",
ADD COLUMN     "tenantId" TEXT;
