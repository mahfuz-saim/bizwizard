/*
  Warnings:

  - You are about to drop the column `Date` on the `payments` table. All the data in the column will be lost.
  - Added the required column `date` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "payments_userId_key";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "Date",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL;
