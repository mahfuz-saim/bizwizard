/*
  Warnings:

  - Added the required column `dob` to the `employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `address` to the `owner` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dob` to the `owner` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "employee" ADD COLUMN     "birthCertificate" TEXT,
ADD COLUMN     "dob" TEXT NOT NULL,
ADD COLUMN     "nid" TEXT;

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "owner" ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "birthCertificate" TEXT,
ADD COLUMN     "dob" TEXT NOT NULL,
ADD COLUMN     "nid" TEXT;
