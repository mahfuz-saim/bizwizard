/*
  Warnings:

  - You are about to drop the column `subscriptionId` on the `shop_payments` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "shop_payments" DROP CONSTRAINT "shop_payments_subscriptionId_fkey";

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "shop_payments" DROP COLUMN "subscriptionId",
ADD COLUMN     "planData" JSONB;
