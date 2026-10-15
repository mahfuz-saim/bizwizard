/*
  Warnings:

  - A unique constraint covering the columns `[sessionKey]` on the table `shop_payments` will be added. If there are existing duplicate values, this will fail.
  - Made the column `email` on table `owner` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "owner" ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "shop_payments" ADD COLUMN     "sessionKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "shop_payments_sessionKey_key" ON "shop_payments"("sessionKey");
