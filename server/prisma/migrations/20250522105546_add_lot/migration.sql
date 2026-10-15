/*
  Warnings:

  - You are about to drop the column `productID` on the `checkout_items` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `draft_order_products` table. All the data in the column will be lost.
  - You are about to drop the column `productID` on the `pickup_items` table. All the data in the column will be lost.
  - You are about to drop the column `amount` on the `product_amounts` table. All the data in the column will be lost.
  - You are about to drop the column `buyPrice` on the `product_amounts` table. All the data in the column will be lost.
  - You are about to drop the column `expDate` on the `product_amounts` table. All the data in the column will be lost.
  - You are about to drop the column `includeVAT` on the `product_amounts` table. All the data in the column will be lost.
  - You are about to drop the column `isMRPDefault` on the `product_amounts` table. All the data in the column will be lost.
  - You are about to drop the column `mfgDate` on the `product_amounts` table. All the data in the column will be lost.
  - You are about to drop the column `mrp` on the `product_amounts` table. All the data in the column will be lost.
  - You are about to drop the column `retail` on the `product_amounts` table. All the data in the column will be lost.
  - You are about to drop the column `salesmanId` on the `product_amounts` table. All the data in the column will be lost.
  - You are about to drop the column `sellPrice` on the `product_amounts` table. All the data in the column will be lost.
  - You are about to drop the column `supplyId` on the `product_amounts` table. All the data in the column will be lost.
  - You are about to drop the column `vat` on the `product_amounts` table. All the data in the column will be lost.
  - Added the required column `lotId` to the `checkout_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lotId` to the `draft_order_products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lotId` to the `pickup_items` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "checkout_items" DROP CONSTRAINT "checkout_items_productID_fkey";

-- DropForeignKey
ALTER TABLE "draft_order_products" DROP CONSTRAINT "draft_order_products_productId_fkey";

-- DropForeignKey
ALTER TABLE "pickup_items" DROP CONSTRAINT "pickup_items_productID_fkey";

-- DropForeignKey
ALTER TABLE "product_amounts" DROP CONSTRAINT "product_amounts_salesmanId_fkey";

-- DropForeignKey
ALTER TABLE "product_amounts" DROP CONSTRAINT "product_amounts_supplyId_fkey";

-- AlterTable
ALTER TABLE "checkout_items" DROP COLUMN "productID",
ADD COLUMN     "lotId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "draft_order_products" DROP COLUMN "productId",
ADD COLUMN     "lotId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "pickup_items" DROP COLUMN "productID",
ADD COLUMN     "lotId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "product_amounts" DROP COLUMN "amount",
DROP COLUMN "buyPrice",
DROP COLUMN "expDate",
DROP COLUMN "includeVAT",
DROP COLUMN "isMRPDefault",
DROP COLUMN "mfgDate",
DROP COLUMN "mrp",
DROP COLUMN "retail",
DROP COLUMN "salesmanId",
DROP COLUMN "sellPrice",
DROP COLUMN "supplyId",
DROP COLUMN "vat";

-- CreateTable
CREATE TABLE "lot" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "mrp" DOUBLE PRECISION NOT NULL,
    "isMRPDefault" BOOLEAN NOT NULL,
    "retail" DOUBLE PRECISION NOT NULL,
    "includeVAT" BOOLEAN NOT NULL,
    "buyPrice" DOUBLE PRECISION NOT NULL,
    "sellPrice" DOUBLE PRECISION NOT NULL,
    "vat" DOUBLE PRECISION,
    "mfgDate" TIMESTAMP(3),
    "expDate" TIMESTAMP(3),
    "supplyId" TEXT,

    CONSTRAINT "lot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "lot" ADD CONSTRAINT "lot_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "shop_supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_items" ADD CONSTRAINT "pickup_items_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_items" ADD CONSTRAINT "checkout_items_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_order_products" ADD CONSTRAINT "draft_order_products_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
