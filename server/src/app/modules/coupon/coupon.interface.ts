import { CouponStatus, DiscountType } from '@prisma/client';

export interface ICreateCoupon {
    code: string;
    description?: string;
    discount: number;
    discountType: DiscountType;
    validFrom: Date;
    validUntil: Date;
    usageLimit: number;
}

export interface IUpdateCoupon {
    description?: string;
    validFrom?: Date;
    validUntil?: Date;
    usageLimit?: number;
    status?: CouponStatus;
}
