-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateTable
CREATE TABLE "draft_orders" (
    "id" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,

    CONSTRAINT "draft_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_order_products" (
    "id" TEXT NOT NULL,
    "orderID" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "draft_order_products_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "draft_orders" ADD CONSTRAINT "draft_orders_shopID_fkey" FOREIGN KEY ("shopID") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_order_products" ADD CONSTRAINT "draft_order_products_orderID_fkey" FOREIGN KEY ("orderID") REFERENCES "draft_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_order_products" ADD CONSTRAINT "draft_order_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product_amounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
