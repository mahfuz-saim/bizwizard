-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateTable
CREATE TABLE "DebtClearHistory" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "debtId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebtClearHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DebtClearHistory" ADD CONSTRAINT "DebtClearHistory_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "debt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
