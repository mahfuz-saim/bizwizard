import prisma from '../../../shared/prisma';
import { JwtPayload } from '../../../interfaces/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import {
    ICreateEmployeePlan,
    ICreateSubscriptionPlan,
    IDeletePlan,
} from './subscriptions.interface';

const getSubscriptionByShopId = async (shopId: string, tenantId: string) => {
    const result = await prisma.subscription.findFirst({
        where: {
            shopId: shopId,
            tenantID: tenantId,
            status: SubscriptionStatus.ACTIVE,
        },
        include: {
            plan: true,
            employeePlan: true,
        },
    });

    return result;
};

const getAllSubscriptionPlans = async () => {
    const subscription = await prisma.subscriptionPlan.findMany({
        where: {
            isActive: true,
        },
    });
    const employeePlan = await prisma.employeeSubscriptionPlan.findMany({
        where: {
            isActive: true,
        },
    });
    const result = {
        subscriptionPlan: subscription,
        employeePlan: employeePlan,
    };
    return result;
};

const addSubscriptionPlan = async (payload: ICreateSubscriptionPlan) => {
    let discountAmount = payload.price;
    if (payload?.discount) {
        discountAmount = discountAmount * (1 - payload.discount);
    }
    const result = await prisma.subscriptionPlan.create({
        data: {
            ...payload,
            features: payload?.features as Prisma.InputJsonValue,
            discountedPrice: discountAmount,
        },
    });

    return result;
};

const addEmployeePlan = async (payload: ICreateEmployeePlan) => {
    let discountAmount = payload.pricePerEmployee;
    if (payload?.discount) {
        discountAmount = discountAmount * (1 - payload.discount);
    }
    const result = await prisma.employeeSubscriptionPlan.create({
        data: {
            ...payload,
            discountedPrice: discountAmount,
        },
    });

    return result;
};

const deletePlan = async (payload: IDeletePlan) => {
    if (payload.type === 'subscription') {
        const result = await prisma.subscriptionPlan.update({
            where: {
                id: payload.id,
            },
            data: {
                isActive: false,
            },
        });
        return result;
    } else if (payload.type === 'employee') {
        const result = await prisma.employeeSubscriptionPlan.update({
            where: {
                id: payload.id,
            },
            data: {
                isActive: false,
            },
        });
        return result;
    }
    throw new Error('Invalid plan type');
};
export const subscriptionService = {
    getSubscriptionByShopId,
    getAllSubscriptionPlans,
    addSubscriptionPlan,
    addEmployeePlan,
    deletePlan,
};
