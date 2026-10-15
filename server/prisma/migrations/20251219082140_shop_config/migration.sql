/*
  Warnings:

  - A unique constraint covering the columns `[shopConfigId]` on the table `shops` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "shopConfigId" TEXT;

-- CreateTable
CREATE TABLE "shop_config" (
    "id" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "defaultExpirationThreshold" INTEGER NOT NULL DEFAULT 1,
    "defaultNotSoldThreshold" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shop_config_shopID_key" ON "shop_config"("shopID");

-- CreateIndex
CREATE UNIQUE INDEX "shops_shopConfigId_key" ON "shops"("shopConfigId");

-- AddForeignKey
ALTER TABLE "shop_config" ADD CONSTRAINT "shop_config_shopID_fkey" FOREIGN KEY ("shopID") REFERENCES "shops"("shopConfigId") ON DELETE RESTRICT ON UPDATE CASCADE;
