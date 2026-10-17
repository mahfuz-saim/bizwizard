import {
    PaymentStatus,
    PaymentType,
    Prisma,
    SubscriptionStatus,
    ShopPayment,
    Coupon,
    DiscountType,
    CouponStatus,
} from '@prisma/client';
import prisma from '../../../shared/prisma';
import { IPayment } from './shopPayment.interface';
import { JwtPayload } from '../../../interfaces/common';
import config from '../../../config';
import { nanoIdHelper } from '../../../helpers/nanoidHelper';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';

type PlanData = {
    planId: string;
    planName: string;
    planType: PaymentType;
    planPrice: number;
    planQuantity: number;
    discountedPrice: number;
    subscriptionId?: string;
    employeePlanId?: string | null;
    employeeSlots?: number;
};

const calculateDiscount = (coupon: Coupon | undefined, amount: number) => {
    if (coupon === undefined) return amount;
    let discountedPrice = amount;
    if (coupon.discountType === DiscountType.PERCENTAGE) {
        discountedPrice = amount - (amount * coupon.discount) / 100;
    } else if (coupon.discountType === DiscountType.AMOUNT) {
        discountedPrice = amount - coupon.discount;
    }
    return discountedPrice;
};

const assertDemoMode = () => {
    if (config.payment.mode !== 'demo') {
        throw new ApiError(
            httpStatus.SERVICE_UNAVAILABLE,
            'No payment gateway is configured. Set PAYMENT_MODE=demo to use demo payments.',
        );
    }
};

const buildSuccessUrl = (successUrl: string, transactionId: string) => {
    // Keep returning a single URL for API compatibility with existing clients.
    // Demo payments complete at initialization, so the client can go straight
    // to its success page with the transaction id attached.
    const url = new URL(successUrl);
    url.searchParams.set('tran_id', transactionId);
    url.searchParams.set('status', 'VALID');
    return url.toString();
};

const initPayment = async (
    payload: IPayment,
    user: JwtPayload,
    tenantId: string,
) => {
    assertDemoMode();

    const tranId = await nanoIdHelper.generateNanoid(12);

    const shop = await prisma.shop.findFirst({
        where: {
            id: payload.shopId,
            tenantID: tenantId,
        },
    });

    if (!shop) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
    }

    let planData: PlanData | null = null;
    let coupon = undefined;

    if (payload?.coupon) {
        coupon = await prisma.coupon.findFirst({
            where: {
                AND: [
                    { code: payload.coupon },
                    { status: CouponStatus.ACTIVE },
                    { validUntil: { gte: new Date() } },
                    { validFrom: { lte: new Date() } },
                ],
            },
        });

        if (
            !coupon ||
            (coupon?.usageLimit && coupon.usageLimit <= coupon.usedCount)
        ) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'Invalid or expired coupon code',
            );
        }
    }

    if (payload.paymentType === PaymentType.SUBSCRIPTION) {
        const subscriptionPlan = await prisma.subscriptionPlan.findUnique({
            where: {
                id: payload.planId,
            },
        });

        if (!subscriptionPlan) {
            throw new Error('Subscription not found');
        }

        if (subscriptionPlan.name === 'TRIAL') {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'You are not allowed to take trial subscription again.',
            );
        }

        const discountedPrice = calculateDiscount(
            coupon,
            subscriptionPlan.discountedPrice,
        );

        const amountsMatch =
            Math.abs(discountedPrice - payload.total_amount) < 0.01;
        if (!amountsMatch) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'Total amount does not match with subscription plan price',
            );
        }

        const existingSubscription = await prisma.subscription.findFirst({
            where: {
                shopId: payload.shopId,
                tenantID: tenantId,
                status: SubscriptionStatus.ACTIVE,
            },
            include: {
                plan: true,
            },
        });

        if (
            existingSubscription &&
            existingSubscription.plan.name !== 'TRIAL'
        ) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'You already have an active subscription. Please cancel it before purchasing a new one.',
            );
        }

        planData = {
            planId: subscriptionPlan.id,
            planName: subscriptionPlan.name,
            planType: PaymentType.SUBSCRIPTION,
            planPrice: subscriptionPlan.discountedPrice,
            planQuantity: 1,
            discountedPrice,
        };
    } else if (payload.paymentType === PaymentType.EMPLOYEE) {
        const employeePlan = await prisma.employeeSubscriptionPlan.findUnique({
            where: {
                id: payload.planId,
            },
        });

        if (!employeePlan) {
            throw new Error('Subscription not found');
        }

        const discountedPrice = calculateDiscount(
            coupon,
            employeePlan.discountedPrice * (payload?.employeeCount || 1),
        );

        const amountsMatch =
            Math.abs(discountedPrice - payload.total_amount) < 0.01;
        if (!amountsMatch) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'Total amount does not match with employee plan price',
            );
        }

        const existingSubscription = await prisma.subscription.findFirst({
            where: {
                shopId: payload.shopId,
                tenantID: tenantId,
                status: SubscriptionStatus.ACTIVE,
            },
        });

        if (!existingSubscription) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                "You don't have an active subscription. Please purchase a subscription before adding employees.",
            );
        }

        planData = {
            planId: employeePlan.id,
            planName: employeePlan.name,
            planType: PaymentType.EMPLOYEE,
            planPrice: employeePlan.discountedPrice,
            planQuantity: payload?.employeeCount || 1,
            subscriptionId: existingSubscription.id,
            discountedPrice,
        };
    } else if (payload.paymentType === PaymentType.RENEW_PLAN) {
        const activePlan = await prisma.subscription.findFirst({
            where: {
                shopId: payload.shopId,
                tenantID: tenantId,
                status: SubscriptionStatus.ACTIVE,
            },
            include: {
                plan: true,
                employeePlan: true,
            },
        });

        if (!activePlan || activePlan.plan.name === 'TRIAL') {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'You do not have an active subscription to renew',
            );
        }

        if (
            !activePlan.plan.isActive ||
            (activePlan.employeePlan && !activePlan.employeePlan.isActive)
        ) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'Subscription Plan or Employee Plan is not active',
            );
        }

        let totalPrice = activePlan.plan.discountedPrice;
        if (activePlan.employeePlan && activePlan.employeeSlots > 0) {
            totalPrice +=
                activePlan.employeeSlots *
                activePlan.employeePlan.discountedPrice;
        }

        const amountsMatch = Math.abs(totalPrice - payload.total_amount) < 0.01;
        if (!amountsMatch) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'Total amount does not match with active plan price',
            );
        }

        planData = {
            subscriptionId: activePlan.id,
            planType: PaymentType.RENEW_PLAN,
            planId: activePlan.plan.id,
            employeePlanId: activePlan.employeePlan?.id || null,
            planName: activePlan.plan.name,
            planPrice: totalPrice,
            employeeSlots: activePlan.employeeSlots,
            planQuantity: 1,
            discountedPrice: totalPrice,
        };
    }

    try {
        await prisma.shopPayment.create({
            data: {
                userId: user.userID,
                shopId: payload.shopId,
                tenantID: tenantId,
                date: new Date(),
                amount: payload.total_amount,
                transactionId: tranId,
                status: PaymentStatus.PENDING,
                paymentType: payload.paymentType,
                planData: planData as Prisma.InputJsonValue,
                couponId: coupon?.id || null,
            },
        });
    } catch (_error) {
        throw new ApiError(
            httpStatus.INTERNAL_SERVER_ERROR,
            'Failed to create payment record',
        );
    }

    try {
        await prisma.$transaction(async tx => {
            await tx.shopPayment.updateMany({
                where: { transactionId: tranId, tenantID: tenantId },
                data: {
                    status: PaymentStatus.VALID,
                    isValidated: true,
                    validatedAt: new Date(),
                    paymentGatewayData: {
                        demo: true,
                        mode: 'demo',
                        message: 'Payment completed in demo mode',
                    },
                },
            });
        });

        await applyPaymentByTransaction(tranId, tenantId);

        if (coupon?.id) {
            await prisma.coupon.update({
                where: { id: coupon.id },
                data: { usedCount: { increment: 1 } },
            });
        }
    } catch (error) {
        await prisma.shopPayment.updateMany({
            where: { transactionId: tranId, tenantID: tenantId },
            data: {
                status: PaymentStatus.FAILED,
                isValidated: true,
                validatedAt: new Date(),
            },
        });
        throw error;
    }

    return buildSuccessUrl(payload.success_url, tranId);
};

const applyPaymentByTransaction = async (
    transactionId: string,
    tenantId: string,
) => {
    const payment = await prisma.shopPayment.findFirstOrThrow({
        where: {
            transactionId,
            tenantID: tenantId,
        },
    });

    if (payment.paymentType === PaymentType.CREDIT) {
        await applyCreditPayment(payment, tenantId);
    } else if (payment.paymentType === PaymentType.SUBSCRIPTION) {
        await applySubscriptionPayment(payment, tenantId);
    } else if (payment.paymentType === PaymentType.EMPLOYEE) {
        await applyEmployeePayment(payment, tenantId);
    } else if (payment.paymentType === PaymentType.RENEW_PLAN) {
        await applySubscriptionRenewPayment(payment, tenantId);
    }
};

const applyCreditPayment = async (payment: ShopPayment, tenantId: string) => {
    await prisma.$transaction(async tx => {
        const conversionRate = await tx.creditConversionRate.findFirst({
            where: {
                isActive: true,
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });

        if (!conversionRate) {
            throw new ApiError(
                httpStatus.NOT_FOUND,
                'No active conversion rate found',
            );
        }

        const creditsToAdd = payment.amount * conversionRate.rate;

        const updatedShop = await tx.shop.updateMany({
            where: {
                id: payment.shopId,
                tenantID: tenantId,
            },
            data: {
                credit: {
                    increment: creditsToAdd,
                },
            },
        });

        if (updatedShop.count === 0) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
        }

        const wallet = await tx.creditWallet.findFirst({
            where: {
                shopId: payment.shopId,
                tenantID: tenantId,
            },
        });

        if (wallet) {
            await tx.creditWallet.update({
                where: { id: wallet.id },
                data: {
                    totalCredits: {
                        increment: creditsToAdd,
                    },
                    creditTopups: {
                        create: {
                            credits: creditsToAdd,
                            shopId: payment.shopId,
                            tenantID: tenantId,
                            paymentId: payment.id,
                        },
                    },
                },
            });
        } else {
            await tx.creditWallet.create({
                data: {
                    shopId: payment.shopId,
                    tenantID: tenantId,
                    totalCredits: creditsToAdd,
                    usedCredits: 0,
                    creditTopups: {
                        create: {
                            credits: creditsToAdd,
                            shopId: payment.shopId,
                            tenantID: tenantId,
                            paymentId: payment.id,
                        },
                    },
                },
            });
        }
    });
};

const applySubscriptionPayment = async (
    payment: ShopPayment,
    tenantId: string,
) => {
    await prisma.$transaction(async tx => {
        const planData = payment.planData as PlanData;
        const subscription = await tx.subscriptionPlan.findUniqueOrThrow({
            where: {
                id: planData.planId,
            },
        });

        const existingSubscription = await tx.subscription.findFirst({
            where: {
                shopId: payment.shopId,
                tenantID: tenantId,
                status: SubscriptionStatus.ACTIVE,
            },
            include: {
                plan: true,
            },
        });

        if (existingSubscription) {
            await tx.subscription.updateMany({
                where: {
                    id: existingSubscription.id,
                    tenantID: tenantId,
                },
                data: {
                    status: SubscriptionStatus.EXPIRED,
                },
            });
        }

        await tx.subscription.create({
            data: {
                shopId: payment.shopId,
                tenantID: tenantId,
                subscriptionPlanId: subscription.id,
                startDate: new Date(),
                endDate: new Date(
                    new Date().setMonth(
                        new Date().getMonth() + subscription.months,
                    ),
                ),
                status: SubscriptionStatus.ACTIVE,
            },
        });
    });
};

const applyEmployeePayment = async (payment: ShopPayment, tenantId: string) => {
    await prisma.$transaction(async tx => {
        const planData = payment.planData as PlanData;
        const subscription =
            await tx.employeeSubscriptionPlan.findUniqueOrThrow({
                where: {
                    id: planData.planId,
                },
            });

        const updatedSubscription = await tx.subscription.updateMany({
            where: {
                id: planData.subscriptionId,
                tenantID: tenantId,
            },
            data: {
                employeePlanId: subscription.id,
                employeeSlots: {
                    increment: planData.planQuantity,
                },
            },
        });

        if (updatedSubscription.count === 0) {
            throw new ApiError(
                httpStatus.NOT_FOUND,
                'Subscription not found for tenant',
            );
        }
    });
};

const applySubscriptionRenewPayment = async (
    payment: ShopPayment,
    tenantId: string,
) => {
    const planData = payment.planData as PlanData;

    await prisma.$transaction(async tx => {
        const subscriptionPlan = await tx.subscriptionPlan.findUniqueOrThrow({
            where: {
                id: planData.planId,
            },
        });

        const activePlan = await tx.subscription.findFirst({
            where: {
                id: planData.subscriptionId,
                tenantID: tenantId,
            },
        });

        if (!activePlan) {
            throw new ApiError(
                httpStatus.NOT_FOUND,
                'Subscription not found for tenant',
            );
        }

        const endDate = calculateRenewEndDate(
            activePlan.endDate || new Date(),
            subscriptionPlan.months,
        );

        const renewedSubscription = await tx.subscription.updateMany({
            where: {
                id: planData.subscriptionId,
                tenantID: tenantId,
            },
            data: {
                endDate,
                status: SubscriptionStatus.ACTIVE,
            },
        });

        if (renewedSubscription.count === 0) {
            throw new ApiError(
                httpStatus.NOT_FOUND,
                'Subscription not found for tenant',
            );
        }
    });
};

const calculateRenewEndDate = (currentEndDate: Date, months: number): Date => {
    const now = new Date();

    if (now > currentEndDate) {
        return new Date(now.setMonth(now.getMonth() + months));
    }

    const newEndDate = new Date(currentEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + months);
    return newEndDate;
};

export const paymentService = { initPayment };
