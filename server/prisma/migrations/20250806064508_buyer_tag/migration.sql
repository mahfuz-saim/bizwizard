-- CreateEnum
CREATE TYPE "SystemTag" AS ENUM ('VIP', 'REGULAR', 'INACTIVE');

-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateTable
CREATE TABLE "BuyerSystemTag" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "tag" "SystemTag" NOT NULL,

    CONSTRAINT "BuyerSystemTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,

    CONSTRAINT "CustomTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerCustomTag" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "BuyerCustomTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuyerSystemTag_buyerId_tag_key" ON "BuyerSystemTag"("buyerId", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "CustomTag_name_shopId_key" ON "CustomTag"("name", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerCustomTag_buyerId_tagId_key" ON "BuyerCustomTag"("buyerId", "tagId");

-- AddForeignKey
ALTER TABLE "BuyerSystemTag" ADD CONSTRAINT "BuyerSystemTag_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "shop_buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomTag" ADD CONSTRAINT "CustomTag_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerCustomTag" ADD CONSTRAINT "BuyerCustomTag_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "shop_buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerCustomTag" ADD CONSTRAINT "BuyerCustomTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CustomTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
