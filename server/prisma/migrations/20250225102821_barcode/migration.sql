/*
  Warnings:

  - A unique constraint covering the columns `[barcode]` on the table `inventory` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "checkouts" ADD COLUMN     "buyerID" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "inventory_barcode_key" ON "inventory"("barcode");

-- AddForeignKey
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_buyerID_fkey" FOREIGN KEY ("buyerID") REFERENCES "buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
