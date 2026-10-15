-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('TOPUP', 'USAGE', 'ADMIN_ADJUSTMENT');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateTable
CREATE TABLE "usage_type" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "currentRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_log" (
    "id" TEXT NOT NULL,
    "usageTypeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "LogType" NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "credit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usage_type_name_key" ON "usage_type"("name");

-- CreateIndex
CREATE UNIQUE INDEX "usage_type_slug_key" ON "usage_type"("slug");

-- AddForeignKey
ALTER TABLE "credit_log" ADD CONSTRAINT "credit_log_usageTypeId_fkey" FOREIGN KEY ("usageTypeId") REFERENCES "usage_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_log" ADD CONSTRAINT "credit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
