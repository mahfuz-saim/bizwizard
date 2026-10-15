-- CreateTable
CREATE TABLE "checkouts" (
    "id" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_items" (
    "id" TEXT NOT NULL,
    "checkoutID" TEXT NOT NULL,
    "productID" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_shopID_fkey" FOREIGN KEY ("shopID") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_items" ADD CONSTRAINT "checkout_items_checkoutID_fkey" FOREIGN KEY ("checkoutID") REFERENCES "checkouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_items" ADD CONSTRAINT "checkout_items_productID_fkey" FOREIGN KEY ("productID") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
