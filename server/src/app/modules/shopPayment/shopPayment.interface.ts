import { PaymentType } from '@prisma/client';

export interface IPayment {
    total_amount: number;
    success_url: string;
    fail_url: string;
    cancel_url: string;
    paymentType: PaymentType;
    planId?: string;
    employeeCount?: number;
    shopId: string;
    coupon: string;
}

export interface IIPN {
    status: string;
    tran_date: Date;
    tran_id: string;
    val_id: string;
    amount: number;
    store_amount: number;
    risk_level: number;
    risk_title: string;
}
