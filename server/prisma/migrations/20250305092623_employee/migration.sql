/*
  Warnings:

  - The values [CUSTOMER] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `point` on the `buyer` table. All the data in the column will be lost.
  - You are about to drop the column `shopID` on the `buyer` table. All the data in the column will be lost.
  - You are about to drop the column `totalDebt` on the `buyer` table. All the data in the column will be lost.
  - You are about to drop the `customers` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[number]` on the table `buyer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userID]` on the table `buyer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[checkoutID,buyerID,shopID]` on the table `debt` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `address` to the `buyer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userID` to the `buyer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopID` to the `debt` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'OWNER', 'BUYER', 'EMPLOYEE');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "buyer" DROP CONSTRAINT "buyer_shopID_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_userID_fkey";

-- DropForeignKey
ALTER TABLE "shops" DROP CONSTRAINT "shops_ownerID_fkey";

-- DropIndex
DROP INDEX "buyer_shopID_number_key";

-- AlterTable
ALTER TABLE "buyer" DROP COLUMN "point",
DROP COLUMN "shopID",
DROP COLUMN "totalDebt",
ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "shopId" TEXT,
ADD COLUMN     "userID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "debt" ADD COLUMN     "shopID" TEXT NOT NULL;

-- DropTable
DROP TABLE "customers";

-- CreateTable
CREATE TABLE "owner" (
    "id" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "number" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "owner_userID_key" ON "owner"("userID");

-- CreateIndex
CREATE UNIQUE INDEX "owner_number_key" ON "owner"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_number_key" ON "Employee"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userID_key" ON "Employee"("userID");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_number_key" ON "buyer"("number");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_userID_key" ON "buyer"("userID");

-- CreateIndex
CREATE UNIQUE INDEX "debt_checkoutID_buyerID_shopID_key" ON "debt"("checkoutID", "buyerID", "shopID");

-- AddForeignKey
ALTER TABLE "owner" ADD CONSTRAINT "owner_userID_fkey" FOREIGN KEY ("userID") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer" ADD CONSTRAINT "buyer_userID_fkey" FOREIGN KEY ("userID") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer" ADD CONSTRAINT "buyer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userID_fkey" FOREIGN KEY ("userID") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_shopID_fkey" FOREIGN KEY ("shopID") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_ownerID_fkey" FOREIGN KEY ("ownerID") REFERENCES "owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt" ADD CONSTRAINT "debt_shopID_fkey" FOREIGN KEY ("shopID") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
