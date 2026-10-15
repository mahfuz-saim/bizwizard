export interface ICreateCheckoutItem {
    lotId: string;
    quantity: number;
    discountAmount: number;
    discountPercentage: number;
    discountType: 'PERCENTAGE' | 'AMOUNT';
}

export interface ICreateCustomCheckoutItem {
    name: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    discountPercentage: number;
    discountType: 'PERCENTAGE' | 'AMOUNT';
}

export interface ICreateCheckout {
    shopID: string;
    status: 'PAID' | 'UNPAID';
    paidAmount?: number;
    buyerID?: string;
    sendSMS: boolean;
    items: ICreateCheckoutItem[];
    customItems?: ICreateCustomCheckoutItem[];
    discountAmount: number;
    discountPercentage: number;
    discountType: 'PERCENTAGE' | 'AMOUNT';
    isDraft: boolean;
}
