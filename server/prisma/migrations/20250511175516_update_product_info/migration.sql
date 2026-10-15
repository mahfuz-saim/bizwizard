/*
  Warnings:

  - You are about to drop the column `sellPrice` on the `product_amounts` table. All the data in the column will be lost.
  - Added the required column `Retail` to the `product_amounts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `includeVAT` to the `product_amounts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isMRPDefault` to the `product_amounts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mrp` to the `product_amounts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "product_amounts" DROP COLUMN "sellPrice",
ADD COLUMN     "Retail" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "expDate" TIMESTAMP(3),
ADD COLUMN     "includeVAT" BOOLEAN NOT NULL,
ADD COLUMN     "isMRPDefault" BOOLEAN NOT NULL,
ADD COLUMN     "lastSoldDate" TIMESTAMP(3),
ADD COLUMN     "locationAtStore" TEXT,
ADD COLUMN     "lowStock" INTEGER,
ADD COLUMN     "lowStockSMS" BOOLEAN,
ADD COLUMN     "mfgDate" TIMESTAMP(3),
ADD COLUMN     "mrp" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "notSoldSMS" BOOLEAN,
ADD COLUMN     "notifyAfterNotSold" INTEGER,
ADD COLUMN     "ntoe" TEXT,
ADD COLUMN     "packOf" INTEGER,
ADD COLUMN     "salesmanId" TEXT,
ADD COLUMN     "variantCode" TEXT,
ADD COLUMN     "variantName" TEXT,
ADD COLUMN     "vat" DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "product_amounts" ADD CONSTRAINT "product_amounts_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "sales_representative"("userID") ON DELETE SET NULL ON UPDATE CASCADE;
