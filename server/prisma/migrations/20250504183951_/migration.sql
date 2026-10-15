/*
  Warnings:

  - A unique constraint covering the columns `[shopCode]` on the table `shops` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `contact` to the `shops` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "contact" TEXT NOT NULL,
ADD COLUMN     "shopCode" TEXT,
ADD COLUMN     "tradeLicense" TEXT;

-- CreateTable
CREATE TABLE "address" (
    "id" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "upazila" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,

    CONSTRAINT "address_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "address_shopId_key" ON "address"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "shops_shopCode_key" ON "shops"("shopCode");

-- AddForeignKey
ALTER TABLE "address" ADD CONSTRAINT "address_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
