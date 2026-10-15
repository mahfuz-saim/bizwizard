/*
  Warnings:

  - You are about to drop the column `Count` on the `shop_join_request` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "shop_join_request" DROP COLUMN "Count",
ADD COLUMN     "count" INTEGER NOT NULL DEFAULT 0;
