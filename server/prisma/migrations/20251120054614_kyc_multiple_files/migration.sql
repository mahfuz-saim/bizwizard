/*
  Warnings:

  - The primary key for the `KYC` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `documentFileType` on the `KYC` table. All the data in the column will be lost.
  - You are about to drop the column `documentURL` on the `KYC` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "KYC" DROP CONSTRAINT "KYC_pkey",
DROP COLUMN "documentFileType",
DROP COLUMN "documentURL",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "KYC_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "KYC_id_seq";

-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateTable
CREATE TABLE "KycDocument" (
    "id" TEXT NOT NULL,
    "kycId" TEXT NOT NULL,
    "documentType" "IdType" NOT NULL,
    "documentURL" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_kycId_fkey" FOREIGN KEY ("kycId") REFERENCES "KYC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
