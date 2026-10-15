/*
  Warnings:

  - A unique constraint covering the columns `[number]` on the table `suppliers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `number` to the `suppliers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "number" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_number_key" ON "suppliers"("number");
