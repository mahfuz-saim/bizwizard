/*
  Warnings:

  - You are about to drop the column `buyPrice` on the `inventory` table. All the data in the column will be lost.
  - You are about to drop the column `sellPrice` on the `inventory` table. All the data in the column will be lost.
  - Added the required column `buyPrice` to the `product_amounts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sellPrice` to the `product_amounts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "inventory" DROP COLUMN "buyPrice",
DROP COLUMN "sellPrice";

-- AlterTable
ALTER TABLE "product_amounts" ADD COLUMN     "buyPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "sellPrice" DOUBLE PRECISION NOT NULL;
