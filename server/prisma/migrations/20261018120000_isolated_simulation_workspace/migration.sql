-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "simulationAsOf" TIMESTAMP(3),
ADD COLUMN     "simulationBaselineAt" TIMESTAMP(3),
ADD COLUMN     "simulationResult" JSONB,
ADD COLUMN     "simulationRunID" TEXT,
ADD COLUMN     "simulationSourceShopID" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "shops_simulationSourceShopID_key" ON "shops"("simulationSourceShopID");

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_simulationSourceShopID_fkey" FOREIGN KEY ("simulationSourceShopID") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
