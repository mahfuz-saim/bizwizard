-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;
