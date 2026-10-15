-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateTable
CREATE TABLE "login_otp" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "otp" INTEGER NOT NULL,
    "exp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_otp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "login_otp_number_key" ON "login_otp"("number");
