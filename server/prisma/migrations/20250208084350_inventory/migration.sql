/*
  Warnings:

  - You are about to drop the column `updateAt` on the `admins` table. All the data in the column will be lost.
  - You are about to drop the column `updateAt` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the `forgetRequest` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `admins` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `customers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "admins" DROP COLUMN "updateAt",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "updateAt",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "forgetRequest";

-- CreateTable
CREATE TABLE "forget_requests" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "OTP" INTEGER NOT NULL,
    "flag" TEXT,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userID" TEXT NOT NULL,

    CONSTRAINT "forget_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shops" (
    "id" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "ownerID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "measuringUnit" TEXT NOT NULL,
    "buyPrice" DOUBLE PRECISION NOT NULL,
    "sellPrice" DOUBLE PRECISION NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_amounts" (
    "id" TEXT NOT NULL,
    "productID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_amounts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "forget_requests" ADD CONSTRAINT "forget_requests_userID_fkey" FOREIGN KEY ("userID") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_ownerID_fkey" FOREIGN KEY ("ownerID") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_amounts" ADD CONSTRAINT "product_amounts_productID_fkey" FOREIGN KEY ("productID") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_amounts" ADD CONSTRAINT "product_amounts_shopID_fkey" FOREIGN KEY ("shopID") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
