-- AlterTable
ALTER TABLE "buyer" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "employee" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;
