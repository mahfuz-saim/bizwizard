import { getMessaging } from 'firebase-admin/messaging';
import '../shared/firebase';
import { SyncTriggerPayload } from '../interfaces/notificationPayload';
import prisma from '../shared/prisma';

interface NotificationPayload {
    notification?: {
        title: string;
        body: string;
    };
    data?: SyncTriggerPayload[] | any;
}

export async function sendNotificationToTokens(
    tokens: string[],
    payload: NotificationPayload,
) {
    if (tokens.length === 0) {
        console.log('No tokens provided');
        return;
    }

    const message: any = {
        data: { notificationData: JSON.stringify(payload.data || {}) },
        tokens,
    };

    if (payload.notification) {
        message.notification = payload.notification;
    }

    try {
        const messaging = getMessaging();
        const response = await messaging.sendEachForMulticast(message);

        if (response.failureCount > 0) {
            const failedTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });
            const deletionResult = await prisma.fCM_Token.deleteMany({
                where: {
                    token: { in: failedTokens },
                },
            });

            // console.warn('List of tokens that caused failures:', failedTokens);
            console.log('‼️ Deleted faulty tokens: ', deletionResult);
        }

        return response;
    } catch (error) {
        console.error('Error sending FCM message:', error);
        throw error;
    }
}
