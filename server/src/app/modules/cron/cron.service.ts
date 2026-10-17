import prisma from '../../../shared/prisma';
import { SubscriptionStatus, UserRole } from '@prisma/client';
import { sendNotificationToTokens } from '../../../helpers/sendPushNotification';

const sendExpirationReminders = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for consistent comparison

    // Fetch all shops
    const all_shops = await prisma.shop.findMany({
        select: {
            id: true,
            tenantID: true,
        },
    });

    // Add shop to the list of shops to notify
    const expiryShopsToNotify: string[] = [];
    const notSoldShopsToNotify: string[] = [];

    // Process all shops in parallel for better performance
    const results = await Promise.allSettled(
        all_shops.map(async item => {
            const shopId = item.id;
            const tenantId = item.tenantID;
            const shopResults = {
                shopId,
                hasExpiry: false,
                hasNotSold: false,
            };

            try {
                // Query lots expiring within each variant's notifyBeforeExp period
                // Uses raw SQL to compare expDate with per-variant threshold: (today + notifyBeforeExp days)
                const all_expired_products = await prisma.$queryRaw<
                    { id: string; variantId: string }[]
                >`
                    SELECT l.id, sv.id as "variantId"
                    FROM "lot" l
                    JOIN "shop_variants" sv ON l."shopVariantId" = sv.id
                    WHERE sv."shopID" = ${shopId}
                      AND l."expDate" IS NOT NULL
                      AND l."expDate" <= (CURRENT_DATE + (sv."notifyBeforeExp" || ' days')::INTERVAL)
                      AND l."expDate" >= CURRENT_DATE
                `;

                // If expired products found, create notification
                if (all_expired_products.length > 0) {
                    shopResults.hasExpiry = true;
                    // Create notification for the shop
                    await prisma.notification.create({
                        data: {
                            shopId: shopId,
                            tenantID: tenantId,
                            title: 'EXPIRATION_REMINDER',
                            body: 'Some products are expiring soon. Please check your inventory.',
                            role: [UserRole.OWNER, UserRole.EMPLOYEE],
                            isPublic: false,
                            data: all_expired_products.map(product => ({
                                lotId: product.id,
                                variantId: product.variantId,
                                dota_type: 'LOT_EXPIRATION_REMINDER',
                            })),
                        },
                    });
                }

                // Find variants that should be notified for not being sold
                // notifyAt is pre-calculated date when notification should be sent
                const notSoldVariants = await prisma.shopVariant.findMany({
                    where: {
                        shopID: shopId,
                        notifyAt: {
                            lte: today, // Notify if notifyAt date has been reached or passed
                        },
                    },
                    select: {
                        id: true,
                        name: true,
                        variantName: true,
                    },
                });

                // If not sold variants found, create notification
                if (notSoldVariants.length > 0) {
                    shopResults.hasNotSold = true;
                    await prisma.notification.create({
                        data: {
                            shopId: shopId,
                            tenantID: tenantId,
                            title: 'Not sold for n days',
                            body: 'Some products were not sold in n days. Please check your inventory.',
                            role: [UserRole.OWNER, UserRole.EMPLOYEE],
                            isPublic: false,
                            data: notSoldVariants.map(variant => ({
                                variantId: variant.id,
                                variantName:
                                    variant.variantName || variant.name,
                                data_type: 'NOT_SOLD_REMINDER',
                            })),
                        },
                    });
                }

                return shopResults;
            } catch (error) {
                // Log error but don't break the entire batch
                console.error(
                    `Error processing reminders for shop ${shopId}:`,
                    error,
                );
                throw error; // Will be caught by Promise.allSettled
            }
        }),
    );

    // Collect shops that need push notifications based on results
    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
            if (result.value.hasExpiry) {
                expiryShopsToNotify.push(result.value.shopId);
            }
            if (result.value.hasNotSold) {
                notSoldShopsToNotify.push(result.value.shopId);
            }
        } else if (result.status === 'rejected') {
            console.error('Shop processing failed:', result.reason);
        }
    });

    // Send push notifications in batch
    await sendNotification(expiryShopsToNotify, {
        title: 'EXPIRATION_REMINDER',
        body: 'Some products are expiring soon. Please check your inventory.',
    });

    await sendNotification(notSoldShopsToNotify, {
        title: 'No Sales Recently',
        body: 'Some products haven’t sold in a while. Check your inventory.',
    });
};

async function sendNotification(shopIds: string[], notification: any) {
    // Fetch FCM tokens for the shops to notify
    const shopTokens = await prisma.fCM_Token.findMany({
        where: {
            shopId: {
                in: shopIds,
            },
        },
        select: {
            token: true,
        },
    });
    const allFCMTokens = shopTokens.map(tokenObj => tokenObj.token);

    // Send push notifications in batch
    const limit = 500; // FCM allows max 500 tokens per request
    const batchCount = Math.ceil(allFCMTokens.length / limit);
    for (let i = 0; i < batchCount; i++) {
        const start = i * limit;
        const end = start + limit;
        const batchTokens = allFCMTokens.slice(start, end);

        await sendNotificationToTokens(batchTokens, {
            notification: notification,
        });
    }
}

async function updateShopSubscription() {
    const today = new Date();
    const result = await prisma.subscription.updateMany({
        where: {
            AND: [
                {
                    endDate: {
                        lt: today,
                    },
                },
                {
                    status: SubscriptionStatus.ACTIVE,
                },
            ],
        },
        data: {
            status: SubscriptionStatus.EXPIRED,
        },
    });
}

export const cronService = {
    sendExpirationReminders,
    updateShopSubscription,
};
