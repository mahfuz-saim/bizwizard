/*
  Warnings:

  - Changed the type of `operationType` on the `audit_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('CREATE', 'READ', 'DELETE', 'UPDATE');

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "operationType",
ADD COLUMN     "operationType" "OperationType" NOT NULL;

-- CreateIndex
CREATE INDEX "audit_logs_operationType_idx" ON "audit_logs"("operationType");
