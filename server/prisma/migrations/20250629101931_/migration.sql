-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "message_request" ADD COLUMN     "approvedById" TEXT;

-- AddForeignKey
ALTER TABLE "message_request" ADD CONSTRAINT "message_request_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "admins"("userID") ON DELETE SET NULL ON UPDATE CASCADE;
