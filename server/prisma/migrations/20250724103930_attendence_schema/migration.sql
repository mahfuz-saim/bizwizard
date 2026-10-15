-- CreateEnum
CREATE TYPE "AttendenceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'PENDING', 'REQUESTED');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateTable
CREATE TABLE "attendence" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "monthYear" TEXT NOT NULL DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY'),
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inTime" TIMESTAMP(3),
    "inStatus" "AttendenceStatus" NOT NULL DEFAULT 'ABSENT',
    "outTime" TIMESTAMP(3),
    "outStatus" "AttendenceStatus" NOT NULL DEFAULT 'ABSENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendence_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "attendence" ADD CONSTRAINT "attendence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;
