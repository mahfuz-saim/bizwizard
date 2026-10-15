/*
  Warnings:

  - Added the required column `appType` to the `app_version` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AppType" AS ENUM ('SHOP', 'SUPPLIER', 'BUYER');

-- AlterTable
ALTER TABLE "app_version" ADD COLUMN     "appType" "AppType" NOT NULL;

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');
