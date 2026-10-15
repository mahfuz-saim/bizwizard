-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SOLD', 'DELETED');

-- CreateEnum
CREATE TYPE "LotDeletionReason" AS ENUM ('EXPIRED', 'RETURNED', 'DAMAGED');

-- CreateEnum
CREATE TYPE "LossType" AS ENUM ('FULL_LOSS', 'PARTIAL_LOSS', 'NO_LOSS');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "lot" ADD COLUMN     "status" "LotStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "lot_adjustments" (
    "id" TEXT NOT NULL,
    "shopVariantId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lossType" "LossType" NOT NULL,
    "lossAmount" DOUBLE PRECISION NOT NULL,
    "reason" "LotDeletionReason" NOT NULL,
    "note" TEXT,
    "deletionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lot_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lot_adjustments_lotId_key" ON "lot_adjustments"("lotId");

-- AddForeignKey
ALTER TABLE "lot_adjustments" ADD CONSTRAINT "lot_adjustments_shopVariantId_fkey" FOREIGN KEY ("shopVariantId") REFERENCES "shop_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_adjustments" ADD CONSTRAINT "lot_adjustments_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
