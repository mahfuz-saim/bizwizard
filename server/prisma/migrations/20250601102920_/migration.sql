/*
  Warnings:

  - You are about to drop the `_BuyerToShop` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_BuyerToShop" DROP CONSTRAINT "_BuyerToShop_A_fkey";

-- DropForeignKey
ALTER TABLE "_BuyerToShop" DROP CONSTRAINT "_BuyerToShop_B_fkey";

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- DropTable
DROP TABLE "_BuyerToShop";

-- CreateTable
CREATE TABLE "shop_buyer" (
    "id" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "buyerID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_buyer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shop_buyer_shopID_buyerID_key" ON "shop_buyer"("shopID", "buyerID");

-- AddForeignKey
ALTER TABLE "shop_buyer" ADD CONSTRAINT "shop_buyer_shopID_fkey" FOREIGN KEY ("shopID") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_buyer" ADD CONSTRAINT "shop_buyer_buyerID_fkey" FOREIGN KEY ("buyerID") REFERENCES "buyer"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;
