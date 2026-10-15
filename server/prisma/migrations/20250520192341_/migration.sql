/*
  Warnings:

  - The values [SUCCESS] on the enum `TopUpStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TopUpStatus_new" AS ENUM ('PENDING', 'ACCEPTED', 'FAILED', 'REJECTED');
ALTER TABLE "credit_topup" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "credit_topup" ALTER COLUMN "status" TYPE "TopUpStatus_new" USING ("status"::text::"TopUpStatus_new");
ALTER TYPE "TopUpStatus" RENAME TO "TopUpStatus_old";
ALTER TYPE "TopUpStatus_new" RENAME TO "TopUpStatus";
DROP TYPE "TopUpStatus_old";
ALTER TABLE "credit_topup" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');
