-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateTable
CREATE TABLE "_BuyerToShop" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BuyerToShop_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_BuyerToShop_B_index" ON "_BuyerToShop"("B");

-- AddForeignKey
ALTER TABLE "_BuyerToShop" ADD CONSTRAINT "_BuyerToShop_A_fkey" FOREIGN KEY ("A") REFERENCES "buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BuyerToShop" ADD CONSTRAINT "_BuyerToShop_B_fkey" FOREIGN KEY ("B") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
