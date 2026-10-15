-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SALES_REPRESENTATIVE';

-- AlterTable
ALTER TABLE "owner" ADD COLUMN     "ReferralCode" TEXT;

-- CreateTable
CREATE TABLE "sales_representative" (
    "id" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "ReferralCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "number" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_representative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_representative_userID_key" ON "sales_representative"("userID");

-- CreateIndex
CREATE UNIQUE INDEX "sales_representative_ReferralCode_key" ON "sales_representative"("ReferralCode");

-- CreateIndex
CREATE UNIQUE INDEX "sales_representative_number_key" ON "sales_representative"("number");

-- AddForeignKey
ALTER TABLE "sales_representative" ADD CONSTRAINT "sales_representative_userID_fkey" FOREIGN KEY ("userID") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner" ADD CONSTRAINT "owner_ReferralCode_fkey" FOREIGN KEY ("ReferralCode") REFERENCES "sales_representative"("ReferralCode") ON DELETE SET NULL ON UPDATE CASCADE;
