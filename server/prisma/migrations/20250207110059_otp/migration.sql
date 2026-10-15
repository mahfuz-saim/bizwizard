/*
  Warnings:

  - Added the required column `OTP` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "OTP" INTEGER NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';
