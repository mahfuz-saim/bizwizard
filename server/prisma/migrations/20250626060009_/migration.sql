/*
  Warnings:

  - You are about to drop the column `quantity` on the `lot_adjustments` table. All the data in the column will be lost.
  - Added the required column `stock` to the `lot_adjustments` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `deletedByType` on the `lot_adjustments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "lot_adjustments" DROP COLUMN "quantity",
ADD COLUMN     "stock" INTEGER NOT NULL,
DROP COLUMN "deletedByType",
ADD COLUMN     "deletedByType" "UserRole" NOT NULL;

-- DropEnum
DROP TYPE "DeletedByType";
