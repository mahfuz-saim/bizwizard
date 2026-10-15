/*
  Warnings:

  - You are about to drop the `DebtPaymebts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DebtPaymebts" DROP CONSTRAINT "DebtPaymebts_debtId_fkey";

-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- DropTable
DROP TABLE "DebtPaymebts";

-- CreateTable
CREATE TABLE "DebtPayments" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "debtId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebtPayments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DebtPayments" ADD CONSTRAINT "DebtPayments_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "debt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
