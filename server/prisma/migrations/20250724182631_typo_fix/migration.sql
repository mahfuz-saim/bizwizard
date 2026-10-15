/*
  Warnings:

  - You are about to drop the `attendence` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'PENDING', 'REQUESTED');

-- DropForeignKey
ALTER TABLE "attendence" DROP CONSTRAINT "attendence_employeeId_fkey";

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- DropTable
DROP TABLE "attendence";

-- DropEnum
DROP TYPE "AttendenceStatus";

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "monthYear" TEXT NOT NULL DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY'),
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inTime" TIMESTAMP(3),
    "inStatus" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "outTime" TIMESTAMP(3),
    "outStatus" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_employeeId_date_key" ON "attendance"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;
