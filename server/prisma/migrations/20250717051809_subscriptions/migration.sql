/*
  Warnings:

  - You are about to drop the column `paymentId` on the `Subscription` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE 'EMPLOYEE';

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_paymentId_fkey";

-- DropIndex
DROP INDEX "Subscription_paymentId_key";

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "paymentId",
ADD COLUMN     "employeePlanId" TEXT,
ADD COLUMN     "employeeSlots" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateTable
CREATE TABLE "employee_subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePerEmployee" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "discount" DOUBLE PRECISION DEFAULT 0.00,
    "discountedPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "employee_subscription_plans_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "shop_payments" ADD CONSTRAINT "shop_payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_employeePlanId_fkey" FOREIGN KEY ("employeePlanId") REFERENCES "employee_subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
