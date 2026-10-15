-- DropForeignKey
ALTER TABLE "shops" DROP CONSTRAINT "shops_ownerID_fkey";

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_ownerID_fkey" FOREIGN KEY ("ownerID") REFERENCES "owner"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;
