/*
  Warnings:

  - The `status` column on the `pickups` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "PickupStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PROCESSING', 'COMPLETE');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "pickups" ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
DROP COLUMN "status",
ADD COLUMN     "status" "PickupStatus" NOT NULL DEFAULT 'PENDING';
