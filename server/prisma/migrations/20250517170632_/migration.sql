/*
  Warnings:

  - A unique constraint covering the columns `[txnId]` on the table `credit_topup` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `txnId` to the `credit_topup` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "credit_topup" ADD COLUMN     "txnId" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateIndex
CREATE UNIQUE INDEX "credit_topup_txnId_key" ON "credit_topup"("txnId");
