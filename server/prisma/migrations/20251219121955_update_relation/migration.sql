/*
  Warnings:

  - You are about to drop the column `shopConfigId` on the `shops` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "shop_config" DROP CONSTRAINT "shop_config_shopID_fkey";

-- DropIndex
DROP INDEX "shops_shopConfigId_key";

-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "shops" DROP COLUMN "shopConfigId";

-- AddForeignKey
ALTER TABLE "shop_config" ADD CONSTRAINT "shop_config_shopID_fkey" FOREIGN KEY ("shopID") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
