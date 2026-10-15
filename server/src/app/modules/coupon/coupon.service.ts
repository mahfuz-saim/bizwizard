import prisma from '../../../shared/prisma';
import { ICreateCoupon, IUpdateCoupon } from './coupon.interface';
import { CouponStatus } from '@prisma/client';

const getAllCoupon = async () => {
    const result = await prisma.coupon.findMany();
    return result;
};

const createCoupon = async (payload: ICreateCoupon) => {
    const result = await prisma.coupon.create({
        data: payload,
    });

    return result;
};

const verifyCoupon = async (couponCode: string) => {
    const coupon = await prisma.coupon.findFirst({
        where: {
            AND: [
                { code: couponCode },
                {
                    validFrom: {
                        lte: new Date(),
                    },
                },
                {
                    validUntil: {
                        gte: new Date(),
                    },
                },
                {
                    status: CouponStatus.ACTIVE,
                },
            ],
        },
    });

    if (!coupon) {
        throw new Error('Invalid or expired coupon code');
    }

    if (coupon.usageLimit !== null && coupon.usageLimit <= coupon.usedCount) {
        throw new Error('Coupon usage limit exceeded');
    }

    return coupon;
};
const updateCoupon = async (couponId: string, payload: IUpdateCoupon) => {
    const coupon = await prisma.coupon.findUniqueOrThrow({
        where: { id: couponId },
    });

    if (payload?.usageLimit && payload.usageLimit < coupon.usedCount) {
        throw new Error('Usage limit cannot be less than used count');
    }
    if (
        payload.validFrom &&
        payload.validUntil &&
        payload.validFrom > payload.validUntil
    ) {
        throw new Error(
            'Valid from date cannot be greater than valid until date',
        );
    }
    if (
        payload.validFrom &&
        coupon.validUntil &&
        payload.validFrom > coupon.validUntil
    ) {
        throw new Error(
            'Valid from date cannot be greater than valid until date',
        );
    }
    if (
        payload.validUntil &&
        coupon.validFrom &&
        payload.validUntil < coupon.validFrom
    ) {
        throw new Error('Valid until date cannot be less than valid from date');
    }
    const result = await prisma.coupon.update({
        where: { id: couponId },
        data: payload,
    });
    return result;
};

const deleteCoupon = async (couponId: string) => {
    const result = await prisma.coupon.update({
        where: { id: couponId },
        data: { status: CouponStatus.INACTIVE },
    });
    return result;
};

export const couponService = {
    getAllCoupon,
    createCoupon,
    verifyCoupon,
    updateCoupon,
    deleteCoupon,
};
