/*
  Warnings:

  - Added the required column `deletedByType` to the `lot_adjustments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DeletedByType" AS ENUM ('OWNER', 'EMPLOYEE');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "lot_adjustments" ADD COLUMN     "deletedByEmployeeId" TEXT,
ADD COLUMN     "deletedByOwnerId" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType" NOT NULL;

-- AddForeignKey
ALTER TABLE "lot_adjustments" ADD CONSTRAINT "lot_adjustments_deletedByOwnerId_fkey" FOREIGN KEY ("deletedByOwnerId") REFERENCES "owner"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_adjustments" ADD CONSTRAINT "lot_adjustments_deletedByEmployeeId_fkey" FOREIGN KEY ("deletedByEmployeeId") REFERENCES "employee"("userID") ON DELETE SET NULL ON UPDATE CASCADE;
