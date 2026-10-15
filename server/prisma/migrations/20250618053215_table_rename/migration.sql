/*
  Warnings:

  - You are about to drop the column `productAmountId` on the `lot` table. All the data in the column will be lost.
  - You are about to drop the `product_amounts` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `shopVariantId` to the `lot` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "lot" DROP CONSTRAINT "lot_productAmountId_fkey";

-- DropForeignKey
ALTER TABLE "product_amounts" DROP CONSTRAINT "product_amounts_productID_fkey";

-- DropForeignKey
ALTER TABLE "product_amounts" DROP CONSTRAINT "product_amounts_shopID_fkey";

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "lot" DROP COLUMN "productAmountId",
ADD COLUMN     "shopVariantId" TEXT NOT NULL;

-- DropTable
DROP TABLE "product_amounts";

-- CreateTable
CREATE TABLE "shop_variants" (
    "id" TEXT NOT NULL,
    "productID" TEXT,
    "name" TEXT,
    "variantName" TEXT,
    "variantCode" TEXT,
    "packOf" INTEGER,
    "shopID" TEXT NOT NULL,
    "lowStock" INTEGER,
    "lowStockSMS" BOOLEAN,
    "lastSoldDate" TIMESTAMP(3),
    "notifyAfterNotSold" INTEGER,
    "notSoldSMS" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "totalProducts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "shop_variants_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "shop_variants" ADD CONSTRAINT "shop_variants_productID_fkey" FOREIGN KEY ("productID") REFERENCES "inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_variants" ADD CONSTRAINT "shop_variants_shopID_fkey" FOREIGN KEY ("shopID") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot" ADD CONSTRAINT "lot_shopVariantId_fkey" FOREIGN KEY ("shopVariantId") REFERENCES "shop_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
