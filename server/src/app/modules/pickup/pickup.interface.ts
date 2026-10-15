import { PaymentStatus, PickupStatus } from '@prisma/client';

export interface ICreatePickupItem {
    lotID: string;
    barcode?: string;
    quantity: number;
}

export interface ICreatePickup {
    shopID: string;
    buyerID: string;
    items: ICreatePickupItem[];
}

export interface IPickUpFilterRequest {
    searchTerm?: string;
    status?: PickupStatus;
    paymentStatus?: PaymentStatus;
    date?: string;
}
