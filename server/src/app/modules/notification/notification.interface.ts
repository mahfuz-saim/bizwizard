import { UserRole } from '@prisma/client';

export interface INotification {
    title: string;
    body: string;
    image?: string;
    userIds?: string[];
    shopIds?: string[];
    data?: {
        dataType:
            | 'SYNC'
            | 'ALERT'
            | 'MESSAGE'
            | 'LOW_STOCK_ALERT'
            | 'OTHER'
            | 'LOT_EXPIRATION_REMINDER';
        data: any;
    }[];
    role?: UserRole[];
}
