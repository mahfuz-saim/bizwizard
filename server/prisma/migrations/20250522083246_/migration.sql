/*
  Warnings:

  - You are about to drop the column `userId` on the `suppliers` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userID]` on the table `suppliers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userID` to the `suppliers` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "shop_supplier" DROP CONSTRAINT "shop_supplier_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "suppliers" DROP CONSTRAINT "suppliers_userId_fkey";

-- DropIndex
DROP INDEX "suppliers_userId_key";

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "suppliers" DROP COLUMN "userId",
ADD COLUMN     "userID" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_userID_key" ON "suppliers"("userID");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_userID_fkey" FOREIGN KEY ("userID") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_supplier" ADD CONSTRAINT "shop_supplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;
