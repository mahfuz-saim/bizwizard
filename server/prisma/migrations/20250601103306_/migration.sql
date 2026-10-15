/*
  Warnings:

  - You are about to drop the column `phone` on the `shop_buyer` table. All the data in the column will be lost.
  - Added the required column `number` to the `shop_buyer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "shop_buyer" DROP COLUMN "phone",
ADD COLUMN     "number" TEXT NOT NULL;
