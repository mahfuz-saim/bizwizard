-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateTable
CREATE TABLE "CreditConversionRate" (
    "id" SERIAL NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "rate" DECIMAL(10,4) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditConversionRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditConversionRate_currencyCode_active_key" ON "CreditConversionRate"("currencyCode", "active");
