-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "shop_config" ADD COLUMN     "defaultLowStockThreshold" INTEGER NOT NULL DEFAULT 15,
ALTER COLUMN "defaultExpirationThreshold" SET DEFAULT 3,
ALTER COLUMN "defaultNotSoldThreshold" SET DEFAULT 30;
