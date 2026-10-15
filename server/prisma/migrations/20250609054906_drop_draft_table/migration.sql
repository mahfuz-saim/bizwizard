/*
  Warnings:

  - You are about to drop the `draft_order_products` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `draft_orders` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "draft_order_products" DROP CONSTRAINT "draft_order_products_lotId_fkey";

-- DropForeignKey
ALTER TABLE "draft_order_products" DROP CONSTRAINT "draft_order_products_orderID_fkey";

-- DropForeignKey
ALTER TABLE "draft_orders" DROP CONSTRAINT "draft_orders_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "draft_orders" DROP CONSTRAINT "draft_orders_shopID_fkey";

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- DropTable
DROP TABLE "draft_order_products";

-- DropTable
DROP TABLE "draft_orders";
