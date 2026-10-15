-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPPLIER';

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "product_amounts" ADD COLUMN     "supplyId" TEXT;

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "image" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_supplier" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "supplierName" TEXT,
    "comment" TEXT,

    CONSTRAINT "shop_supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_userId_key" ON "suppliers"("userId");

-- AddForeignKey
ALTER TABLE "product_amounts" ADD CONSTRAINT "product_amounts_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "shop_supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_supplier" ADD CONSTRAINT "shop_supplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_supplier" ADD CONSTRAINT "shop_supplier_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
