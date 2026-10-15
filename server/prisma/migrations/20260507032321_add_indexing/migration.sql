-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- AlterTable
ALTER TABLE "expense" ALTER COLUMN "monthYear" SET DEFAULT TO_CHAR(CURRENT_DATE, 'MONTH-YYYY');

-- CreateIndex
CREATE INDEX "DebtPayments_debtId_idx" ON "DebtPayments"("debtId");

-- CreateIndex
CREATE INDEX "KYC_verificationStatus_idx" ON "KYC"("verificationStatus");

-- CreateIndex
CREATE INDEX "KYC_isVerified_idx" ON "KYC"("isVerified");

-- CreateIndex
CREATE INDEX "KycDocument_kycId_idx" ON "KycDocument"("kycId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_shopId_idx" ON "Notification"("shopId");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_isPublic_idx" ON "Notification"("isPublic");

-- CreateIndex
CREATE INDEX "NotificationRead_notificationId_userId_idx" ON "NotificationRead"("notificationId", "userId");

-- CreateIndex
CREATE INDEX "Subscription_shopId_idx" ON "Subscription"("shopId");

-- CreateIndex
CREATE INDEX "Subscription_subscriptionPlanId_idx" ON "Subscription"("subscriptionPlanId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_endDate_idx" ON "Subscription"("endDate");

-- CreateIndex
CREATE INDEX "app_version_appType_idx" ON "app_version"("appType");

-- CreateIndex
CREATE INDEX "app_version_isMandatory_idx" ON "app_version"("isMandatory");

-- CreateIndex
CREATE INDEX "attendance_monthYear_idx" ON "attendance"("monthYear");

-- CreateIndex
CREATE INDEX "checkout_items_checkoutID_idx" ON "checkout_items"("checkoutID");

-- CreateIndex
CREATE INDEX "checkout_items_lotId_idx" ON "checkout_items"("lotId");

-- CreateIndex
CREATE INDEX "checkout_items_inventoryId_idx" ON "checkout_items"("inventoryId");

-- CreateIndex
CREATE INDEX "checkouts_shopID_createdAt_idx" ON "checkouts"("shopID", "createdAt");

-- CreateIndex
CREATE INDEX "checkouts_buyerID_idx" ON "checkouts"("buyerID");

-- CreateIndex
CREATE INDEX "checkouts_status_idx" ON "checkouts"("status");

-- CreateIndex
CREATE INDEX "coupons_status_idx" ON "coupons"("status");

-- CreateIndex
CREATE INDEX "coupons_validUntil_idx" ON "coupons"("validUntil");

-- CreateIndex
CREATE INDEX "credit_topups_shopId_idx" ON "credit_topups"("shopId");

-- CreateIndex
CREATE INDEX "credit_topups_walletId_idx" ON "credit_topups"("walletId");

-- CreateIndex
CREATE INDEX "credit_topups_addedAt_idx" ON "credit_topups"("addedAt");

-- CreateIndex
CREATE INDEX "credit_usages_shopId_idx" ON "credit_usages"("shopId");

-- CreateIndex
CREATE INDEX "credit_usages_walletId_idx" ON "credit_usages"("walletId");

-- CreateIndex
CREATE INDEX "credit_usages_usedAt_idx" ON "credit_usages"("usedAt");

-- CreateIndex
CREATE INDEX "debt_shopID_idx" ON "debt"("shopID");

-- CreateIndex
CREATE INDEX "debt_buyerID_idx" ON "debt"("buyerID");

-- CreateIndex
CREATE INDEX "employee_shopID_idx" ON "employee"("shopID");

-- CreateIndex
CREATE INDEX "employee_subscription_plans_isActive_idx" ON "employee_subscription_plans"("isActive");

-- CreateIndex
CREATE INDEX "expense_item_expenseID_idx" ON "expense_item"("expenseID");

-- CreateIndex
CREATE INDEX "expense_item_shopVariantId_idx" ON "expense_item"("shopVariantId");

-- CreateIndex
CREATE INDEX "expense_item_lotId_idx" ON "expense_item"("lotId");

-- CreateIndex
CREATE INDEX "expense_item_supplierId_idx" ON "expense_item"("supplierId");

-- CreateIndex
CREATE INDEX "fcm_tokens_tenantId_idx" ON "fcm_tokens"("tenantId");

-- CreateIndex
CREATE INDEX "fcm_tokens_shopId_idx" ON "fcm_tokens"("shopId");

-- CreateIndex
CREATE INDEX "forget_requests_number_idx" ON "forget_requests"("number");

-- CreateIndex
CREATE INDEX "forget_requests_userID_idx" ON "forget_requests"("userID");

-- CreateIndex
CREATE INDEX "forget_requests_isChecked_idx" ON "forget_requests"("isChecked");

-- CreateIndex
CREATE INDEX "login_otp_exp_idx" ON "login_otp"("exp");

-- CreateIndex
CREATE INDEX "lot_shopVariantId_idx" ON "lot"("shopVariantId");

-- CreateIndex
CREATE INDEX "lot_supplyId_idx" ON "lot"("supplyId");

-- CreateIndex
CREATE INDEX "lot_status_idx" ON "lot"("status");

-- CreateIndex
CREATE INDEX "lot_expDate_idx" ON "lot"("expDate");

-- CreateIndex
CREATE INDEX "lot_adjustments_shopVariantId_idx" ON "lot_adjustments"("shopVariantId");

-- CreateIndex
CREATE INDEX "lot_adjustments_deletedByOwnerId_idx" ON "lot_adjustments"("deletedByOwnerId");

-- CreateIndex
CREATE INDEX "lot_adjustments_deletedByEmployeeId_idx" ON "lot_adjustments"("deletedByEmployeeId");

-- CreateIndex
CREATE INDEX "lot_adjustments_deletionDate_idx" ON "lot_adjustments"("deletionDate");

-- CreateIndex
CREATE INDEX "messages_shopId_idx" ON "messages"("shopId");

-- CreateIndex
CREATE INDEX "messages_approvalStatus_idx" ON "messages"("approvalStatus");

-- CreateIndex
CREATE INDEX "messages_sentStatus_idx" ON "messages"("sentStatus");

-- CreateIndex
CREATE INDEX "messages_scheduledAt_idx" ON "messages"("scheduledAt");

-- CreateIndex
CREATE INDEX "note_shopID_idx" ON "note"("shopID");

-- CreateIndex
CREATE INDEX "note_dueDate_idx" ON "note"("dueDate");

-- CreateIndex
CREATE INDEX "note_isComplete_idx" ON "note"("isComplete");

-- CreateIndex
CREATE INDEX "pickup_items_pickupID_idx" ON "pickup_items"("pickupID");

-- CreateIndex
CREATE INDEX "pickup_items_lotId_idx" ON "pickup_items"("lotId");

-- CreateIndex
CREATE INDEX "pickup_items_inventoryId_idx" ON "pickup_items"("inventoryId");

-- CreateIndex
CREATE INDEX "pickups_shopID_idx" ON "pickups"("shopID");

-- CreateIndex
CREATE INDEX "pickups_buyerID_idx" ON "pickups"("buyerID");

-- CreateIndex
CREATE INDEX "pickups_status_idx" ON "pickups"("status");

-- CreateIndex
CREATE INDEX "pickups_paymentStatus_idx" ON "pickups"("paymentStatus");

-- CreateIndex
CREATE INDEX "referral_rewards_referrerShopId_idx" ON "referral_rewards"("referrerShopId");

-- CreateIndex
CREATE INDEX "referral_rewards_referredShopId_idx" ON "referral_rewards"("referredShopId");

-- CreateIndex
CREATE INDEX "referral_rewards_referrerStatus_idx" ON "referral_rewards"("referrerStatus");

-- CreateIndex
CREATE INDEX "referral_rewards_referredStatus_idx" ON "referral_rewards"("referredStatus");

-- CreateIndex
CREATE INDEX "referrals_referralCodeId_idx" ON "referrals"("referralCodeId");

-- CreateIndex
CREATE INDEX "shop_buyer_buyerID_idx" ON "shop_buyer"("buyerID");

-- CreateIndex
CREATE INDEX "shop_buyer_number_idx" ON "shop_buyer"("number");

-- CreateIndex
CREATE INDEX "shop_payments_shopId_idx" ON "shop_payments"("shopId");

-- CreateIndex
CREATE INDEX "shop_payments_userId_idx" ON "shop_payments"("userId");

-- CreateIndex
CREATE INDEX "shop_payments_status_idx" ON "shop_payments"("status");

-- CreateIndex
CREATE INDEX "shop_payments_date_idx" ON "shop_payments"("date");

-- CreateIndex
CREATE INDEX "shop_supplier_shopId_idx" ON "shop_supplier"("shopId");

-- CreateIndex
CREATE INDEX "shop_supplier_supplierId_idx" ON "shop_supplier"("supplierId");

-- CreateIndex
CREATE INDEX "shop_supplier_number_idx" ON "shop_supplier"("number");

-- CreateIndex
CREATE INDEX "shop_variants_productID_idx" ON "shop_variants"("productID");

-- CreateIndex
CREATE INDEX "shops_ownerID_idx" ON "shops"("ownerID");

-- CreateIndex
CREATE INDEX "subscription_plans_isActive_idx" ON "subscription_plans"("isActive");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");
