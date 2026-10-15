/*
  Warnings:

  - Added the required column `requestedById` to the `credit_topup` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "credit_topup" ADD COLUMN     "requestedById" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AddForeignKey
ALTER TABLE "credit_topup" ADD CONSTRAINT "credit_topup_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
