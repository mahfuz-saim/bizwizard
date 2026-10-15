-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_tenantID_fkey";

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "tenantID" DROP NOT NULL;

-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
