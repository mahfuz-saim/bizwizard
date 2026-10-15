-- CreateTable
CREATE TABLE "pickups" (
    "id" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "buyerID" TEXT,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_items" (
    "id" TEXT NOT NULL,
    "pickupID" TEXT NOT NULL,
    "productID" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_shopID_fkey" FOREIGN KEY ("shopID") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_buyerID_fkey" FOREIGN KEY ("buyerID") REFERENCES "buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_items" ADD CONSTRAINT "pickup_items_pickupID_fkey" FOREIGN KEY ("pickupID") REFERENCES "pickups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_items" ADD CONSTRAINT "pickup_items_productID_fkey" FOREIGN KEY ("productID") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
