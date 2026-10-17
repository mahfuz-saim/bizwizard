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
