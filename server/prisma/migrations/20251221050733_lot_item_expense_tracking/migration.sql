-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense_item" ADD COLUMN     "lotId" TEXT,
ADD COLUMN     "quantity" INTEGER,
ADD COLUMN     "shopVariantId" TEXT,
ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "unitPrice" DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "expense_item" ADD CONSTRAINT "expense_item_shopVariantId_fkey" FOREIGN KEY ("shopVariantId") REFERENCES "shop_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_item" ADD CONSTRAINT "expense_item_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_item" ADD CONSTRAINT "expense_item_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "shop_supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
