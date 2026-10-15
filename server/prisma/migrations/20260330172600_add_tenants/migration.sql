/*
  Warnings:

  - Added the required column `tenantID` to the `BuyerCustomTag` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `BuyerSystemTag` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `CustomTag` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `NotificationRead` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `buyer_debt_ledger` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `checkout_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `checkouts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `credit_topups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `credit_usages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `credit_wallets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `debt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `expense_item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `fcm_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `lot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `lot_adjustments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `note` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `pickup_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `pickups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `referral_rewards` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `shop_buyer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `shop_config` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `shop_join_request` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `shop_payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `shop_supplier` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `shop_variants` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantID` to the `shops` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BuyerCustomTag" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "BuyerSystemTag" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CustomTag" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "NotificationRead" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "address" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "tenantID" TEXT NOT NULL,
ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "buyer_debt_ledger" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "checkout_items" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "checkouts" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "credit_topups" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "credit_usages" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "credit_wallets" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "debt" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "employee" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "expense" ADD COLUMN     "tenantID" TEXT NOT NULL,
ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense_item" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "fcm_tokens" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "lot" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "lot_adjustments" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "note" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "pickup_items" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "pickups" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "referral_rewards" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "shop_buyer" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "shop_config" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "shop_join_request" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "shop_payments" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "shop_supplier" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "shop_variants" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "tenantID" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "ownerID" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_code_key" ON "tenants"("code");

-- CreateIndex
CREATE INDEX "tenants_ownerID_idx" ON "tenants"("ownerID");

-- CreateIndex
CREATE INDEX "BuyerCustomTag_tenantID_idx" ON "BuyerCustomTag"("tenantID");

-- CreateIndex
CREATE INDEX "BuyerSystemTag_tenantID_idx" ON "BuyerSystemTag"("tenantID");

-- CreateIndex
CREATE INDEX "CustomTag_tenantID_idx" ON "CustomTag"("tenantID");

-- CreateIndex
CREATE INDEX "Notification_tenantID_idx" ON "Notification"("tenantID");

-- CreateIndex
CREATE INDEX "NotificationRead_tenantID_idx" ON "NotificationRead"("tenantID");

-- CreateIndex
CREATE INDEX "Subscription_tenantID_idx" ON "Subscription"("tenantID");

-- CreateIndex
CREATE INDEX "address_tenantID_idx" ON "address"("tenantID");

-- CreateIndex
CREATE INDEX "attendance_tenantID_idx" ON "attendance"("tenantID");

-- CreateIndex
CREATE INDEX "buyer_debt_ledger_tenantID_idx" ON "buyer_debt_ledger"("tenantID");

-- CreateIndex
CREATE INDEX "checkout_items_tenantID_idx" ON "checkout_items"("tenantID");

-- CreateIndex
CREATE INDEX "checkouts_tenantID_idx" ON "checkouts"("tenantID");

-- CreateIndex
CREATE INDEX "credit_topups_tenantID_idx" ON "credit_topups"("tenantID");

-- CreateIndex
CREATE INDEX "credit_usages_tenantID_idx" ON "credit_usages"("tenantID");

-- CreateIndex
CREATE INDEX "credit_wallets_tenantID_idx" ON "credit_wallets"("tenantID");

-- CreateIndex
CREATE INDEX "debt_tenantID_idx" ON "debt"("tenantID");

-- CreateIndex
CREATE INDEX "employee_tenantID_idx" ON "employee"("tenantID");

-- CreateIndex
CREATE INDEX "expense_tenantID_idx" ON "expense"("tenantID");

-- CreateIndex
CREATE INDEX "expense_item_tenantID_idx" ON "expense_item"("tenantID");

-- CreateIndex
CREATE INDEX "fcm_tokens_tenantID_idx" ON "fcm_tokens"("tenantID");

-- CreateIndex
CREATE INDEX "lot_tenantID_idx" ON "lot"("tenantID");

-- CreateIndex
CREATE INDEX "lot_adjustments_tenantID_idx" ON "lot_adjustments"("tenantID");

-- CreateIndex
CREATE INDEX "messages_tenantID_idx" ON "messages"("tenantID");

-- CreateIndex
CREATE INDEX "note_tenantID_idx" ON "note"("tenantID");

-- CreateIndex
CREATE INDEX "pickup_items_tenantID_idx" ON "pickup_items"("tenantID");

-- CreateIndex
CREATE INDEX "pickups_tenantID_idx" ON "pickups"("tenantID");

-- CreateIndex
CREATE INDEX "referral_rewards_tenantID_idx" ON "referral_rewards"("tenantID");

-- CreateIndex
CREATE INDEX "shop_buyer_tenantID_idx" ON "shop_buyer"("tenantID");

-- CreateIndex
CREATE INDEX "shop_config_tenantID_idx" ON "shop_config"("tenantID");

-- CreateIndex
CREATE INDEX "shop_join_request_tenantID_idx" ON "shop_join_request"("tenantID");

-- CreateIndex
CREATE INDEX "shop_payments_tenantID_idx" ON "shop_payments"("tenantID");

-- CreateIndex
CREATE INDEX "shop_supplier_tenantID_idx" ON "shop_supplier"("tenantID");

-- CreateIndex
CREATE INDEX "shop_variants_tenantID_idx" ON "shop_variants"("tenantID");

-- CreateIndex
CREATE INDEX "shops_tenantID_idx" ON "shops"("tenantID");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_ownerID_fkey" FOREIGN KEY ("ownerID") REFERENCES "owner"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_config" ADD CONSTRAINT "shop_config_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_buyer" ADD CONSTRAINT "shop_buyer_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerSystemTag" ADD CONSTRAINT "BuyerSystemTag_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomTag" ADD CONSTRAINT "CustomTag_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerCustomTag" ADD CONSTRAINT "BuyerCustomTag_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt" ADD CONSTRAINT "debt_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_debt_ledger" ADD CONSTRAINT "buyer_debt_ledger_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_variants" ADD CONSTRAINT "shop_variants_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot" ADD CONSTRAINT "lot_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_adjustments" ADD CONSTRAINT "lot_adjustments_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_items" ADD CONSTRAINT "pickup_items_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_items" ADD CONSTRAINT "checkout_items_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_payments" ADD CONSTRAINT "shop_payments_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_topups" ADD CONSTRAINT "credit_topups_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_usages" ADD CONSTRAINT "credit_usages_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_item" ADD CONSTRAINT "expense_item_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address" ADD CONSTRAINT "address_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_join_request" ADD CONSTRAINT "shop_join_request_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_supplier" ADD CONSTRAINT "shop_supplier_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fcm_tokens" ADD CONSTRAINT "fcm_tokens_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_tenantID_fkey" FOREIGN KEY ("tenantID") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
