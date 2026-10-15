/*
  Warnings:

  - You are about to drop the column `amount` on the `lot` table. All the data in the column will be lost.
  - Added the required column `stock` to the `lot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "lot" DROP COLUMN "amount",
ADD COLUMN     "stock" INTEGER NOT NULL;
