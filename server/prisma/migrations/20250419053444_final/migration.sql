/*
  Warnings:

  - You are about to drop the column `shopId` on the `buyer` table. All the data in the column will be lost.
  - You are about to drop the `shop_employee` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `buyerID` on table `pickups` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('EMPLOYEE_SALARY', 'GENERAL', 'PRODUCT');

-- DropForeignKey
ALTER TABLE "buyer" DROP CONSTRAINT "buyer_shopId_fkey";

-- DropForeignKey
ALTER TABLE "checkout_items" DROP CONSTRAINT "checkout_items_productID_fkey";

-- DropForeignKey
ALTER TABLE "pickup_items" DROP CONSTRAINT "pickup_items_productID_fkey";

-- DropForeignKey
ALTER TABLE "pickups" DROP CONSTRAINT "pickups_buyerID_fkey";

-- DropForeignKey
ALTER TABLE "product_amounts" DROP CONSTRAINT "product_amounts_productID_fkey";

-- DropForeignKey
ALTER TABLE "shop_employee" DROP CONSTRAINT "shop_employee_employeeID_fkey";

-- DropForeignKey
ALTER TABLE "shop_employee" DROP CONSTRAINT "shop_employee_shopID_fkey";

-- DropIndex
DROP INDEX "product_amounts_productID_shopID_key";

-- AlterTable
ALTER TABLE "buyer" DROP COLUMN "shopId";

-- AlterTable
ALTER TABLE "checkout_items" ADD COLUMN     "inventoryId" TEXT;

-- AlterTable
ALTER TABLE "employee" ADD COLUMN     "shopID" TEXT;

-- AlterTable
ALTER TABLE "pickup_items" ADD COLUMN     "inventoryId" TEXT;

-- AlterTable
ALTER TABLE "pickups" ALTER COLUMN "buyerID" SET NOT NULL;

-- AlterTable
ALTER TABLE "product_amounts" ADD COLUMN     "name" TEXT,
ALTER COLUMN "productID" DROP NOT NULL;

-- DropTable
DROP TABLE "shop_employee";

-- CreateTable
CREATE TABLE "expense" (
    "id" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthYear" TEXT NOT NULL DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY'),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_item" (
    "id" TEXT NOT NULL,
    "expenseID" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_item_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_shopID_fkey" FOREIGN KEY ("shopID") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_amounts" ADD CONSTRAINT "product_amounts_productID_fkey" FOREIGN KEY ("productID") REFERENCES "inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_buyerID_fkey" FOREIGN KEY ("buyerID") REFERENCES "buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_items" ADD CONSTRAINT "pickup_items_productID_fkey" FOREIGN KEY ("productID") REFERENCES "product_amounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_items" ADD CONSTRAINT "pickup_items_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_items" ADD CONSTRAINT "checkout_items_productID_fkey" FOREIGN KEY ("productID") REFERENCES "product_amounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_items" ADD CONSTRAINT "checkout_items_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_shopID_fkey" FOREIGN KEY ("shopID") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_item" ADD CONSTRAINT "expense_item_expenseID_fkey" FOREIGN KEY ("expenseID") REFERENCES "expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
