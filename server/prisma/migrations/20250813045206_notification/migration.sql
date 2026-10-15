-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_shopId_fkey";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "shopId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;
