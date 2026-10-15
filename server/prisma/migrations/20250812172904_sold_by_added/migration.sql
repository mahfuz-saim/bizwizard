-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "checkouts" ADD COLUMN     "soldBy" "UserRole",
ADD COLUMN     "soldByEmployeeId" TEXT,
ADD COLUMN     "soldByOwnerId" TEXT;

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AddForeignKey
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_soldByOwnerId_fkey" FOREIGN KEY ("soldByOwnerId") REFERENCES "owner"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_soldByEmployeeId_fkey" FOREIGN KEY ("soldByEmployeeId") REFERENCES "employee"("userID") ON DELETE SET NULL ON UPDATE CASCADE;
