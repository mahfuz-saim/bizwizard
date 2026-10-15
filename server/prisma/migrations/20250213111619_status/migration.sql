/*
  Warnings:

  - Added the required column `status` to the `checkouts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'UNPAID');

-- AlterTable
ALTER TABLE "checkouts" ADD COLUMN     "status" "PaymentStatus" NOT NULL;
