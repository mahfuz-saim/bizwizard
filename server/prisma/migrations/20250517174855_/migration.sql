/*
  Warnings:

  - You are about to drop the column `userId` on the `credit_topup` table. All the data in the column will be lost.
  - Added the required column `shopId` to the `credit_log` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopId` to the `credit_topup` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "credit_log" DROP CONSTRAINT "credit_log_userId_fkey";

-- DropForeignKey
ALTER TABLE "credit_topup" DROP CONSTRAINT "credit_topup_userId_fkey";

-- AlterTable
ALTER TABLE "credit_log" ADD COLUMN     "shopId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "credit_topup" DROP COLUMN "userId",
ADD COLUMN     "handledById" TEXT,
ADD COLUMN     "shopId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AddForeignKey
ALTER TABLE "credit_log" ADD CONSTRAINT "credit_log_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_topup" ADD CONSTRAINT "credit_topup_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_topup" ADD CONSTRAINT "credit_topup_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
