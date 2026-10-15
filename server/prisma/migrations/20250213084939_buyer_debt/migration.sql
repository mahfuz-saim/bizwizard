-- CreateTable
CREATE TABLE "debt" (
    "id" TEXT NOT NULL,
    "checkoutID" TEXT NOT NULL,
    "buyerID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shopID" TEXT NOT NULL,
    "totalDebt" DOUBLE PRECISION NOT NULL,
    "point" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "debt_checkoutID_key" ON "debt"("checkoutID");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_shopID_number_key" ON "buyer"("shopID", "number");

-- AddForeignKey
ALTER TABLE "debt" ADD CONSTRAINT "debt_checkoutID_fkey" FOREIGN KEY ("checkoutID") REFERENCES "checkouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt" ADD CONSTRAINT "debt_buyerID_fkey" FOREIGN KEY ("buyerID") REFERENCES "buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer" ADD CONSTRAINT "buyer_shopID_fkey" FOREIGN KEY ("shopID") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
