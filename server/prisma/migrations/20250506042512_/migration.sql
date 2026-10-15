-- CreateEnum
CREATE TYPE "ShopJoinRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateTable
CREATE TABLE "shop_join_request" (
    "shopID" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "status" "ShopJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "Count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "shop_join_request_userID_key" ON "shop_join_request"("userID");

-- CreateIndex
CREATE UNIQUE INDEX "shop_join_request_shopID_userID_key" ON "shop_join_request"("shopID", "userID");

-- AddForeignKey
ALTER TABLE "shop_join_request" ADD CONSTRAINT "shop_join_request_shopID_fkey" FOREIGN KEY ("shopID") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_join_request" ADD CONSTRAINT "shop_join_request_userID_fkey" FOREIGN KEY ("userID") REFERENCES "employee"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;
