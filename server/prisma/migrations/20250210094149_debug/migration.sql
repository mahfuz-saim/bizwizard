/*
  Warnings:

  - A unique constraint covering the columns `[productID,shopID]` on the table `product_amounts` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `amount` to the `product_amounts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "product_amounts" ADD COLUMN     "amount" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "product_amounts_productID_shopID_key" ON "product_amounts"("productID", "shopID");
