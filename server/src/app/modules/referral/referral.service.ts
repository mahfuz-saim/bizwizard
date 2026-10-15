import { JwtPayload } from '../../../interfaces/common';
import { UserRole } from '@prisma/client';
import prisma from '../../../shared/prisma';
import { IReferralClaim } from './referral.interface';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';
import { salesRepCreditService } from '../salesRepCredit/salesRepCredit.service';

const getAllReferralRewards = async (user: JwtPayload, tenantId?: string) => {
    const userId = user.userID;

    if (user.role === UserRole.SALES_REPRESENTATIVE) {
        return getAllReferralRewardsForSR(userId);
    }

    // Owner / employee branch — existing behavior, untouched
    return getAllReferralRewardsForOwner(userId, tenantId);
};

const getAllReferralRewardsForOwner = async (
    userId: string,
    tenantId?: string,
) => {
    const owner = await prisma.owner.findUniqueOrThrow({
        where: { userID: userId },
        include: {
            referral: {
                include: {
                    rewards: true,
                },
            },
            ReferralCode: {
                include: {
                    Referrals: {
                        include: {
                            rewards: {
                                where: tenantId
                                    ? {
                                          OR: [
                                              {
                                                  referredTenantId: tenantId,
                                              },
                                              {
                                                  referrerTenantId: tenantId,
                                              },
                                          ],
                                      }
                                    : undefined,
                            },
                            referredUser: true,
                        },
                    },
                },
            },
        },
    });

    const rewards: {
        asReferred: any;
        asReferrer: any[];
    } = {
        asReferred: null,
        asReferrer: [],
    };

    // Check if user was referred (they get a reward)
    if (owner.referral?.rewards?.length) {
        const reward = owner.referral.rewards[0];
        if (reward.referredStatus === 'PENDING') {
            rewards.asReferred = {
                rewardId: reward.id,
                credits: reward.referredCredits,
                subDays: reward.referredSubDays,
                createdAt: reward.createdAt,
            };
        }
    }

    // Check if user referred others (they get rewards)
    if (owner.ReferralCode?.Referrals) {
        for (const referral of owner.ReferralCode.Referrals) {
            for (const reward of referral.rewards ?? []) {
                if (reward.referrerStatus === 'PENDING') {
                    rewards.asReferrer.push({
                        rewardId: reward.id,
                        credits: reward.referrerCredits,
                        subDays: reward.referrerSubDays,
                        createdAt: reward.createdAt,
                        referredUserId: referral.referredUser?.userID,
                    });
                }
            }
        }
    }

    return rewards;
};

const getAllReferralRewardsForSR = async (userId: string) => {
    // asReferrer: main reward rows where this SR is the referrer (referrerSalesRepId).
    // The main reward is the one tied to a Referral (chainBonusReferralId null).
    const asReferrerRows = await prisma.referralReward.findMany({
        where: {
            referrerSalesRepId: userId,
            referrerStatus: 'PENDING',
            chainBonusReferralId: null,
        },
        include: {
            Referral: {
                include: {
                    referredUser: true,
                },
            },
        },
    });

    const asReferrer = asReferrerRows.map(r => ({
        rewardId: r.id,
        credits: r.referrerCredits,
        createdAt: r.createdAt,
        referredOwnerId: r.Referral?.referredUser?.userID ?? null,
    }));

    // chainBonuses: chain-bonus reward rows owed to this SR (referrerSalesRepId = me).
    // The presence of chainBonusReferralId tells us this is a chain bonus.
    const chainBonusRows = await prisma.referralReward.findMany({
        where: {
            referrerSalesRepId: userId,
            referrerStatus: 'PENDING',
            chainBonusReferralId: { not: null },
        },
        include: {
            chainBonusReferral: {
                include: {
                    referredUser: true,
                },
            },
        },
    });

    const chainBonuses = chainBonusRows.map(r => ({
        rewardId: r.id,
        credits: r.referrerCredits,
        createdAt: r.createdAt,
        // the owner that triggered the chain bonus (downstream SR's first owner conversion)
        referredOwnerId:
            r.chainBonusReferral?.referredUser?.userID ?? null,
    }));

    // outstandingChainPromises: pending promises where I am the upstream.
    const outstandingRows = await prisma.referralChainPromise.findMany({
        where: {
            upstreamSalesRepId: userId,
            status: 'PENDING',
        },
        include: {
            downstreamSalesRep: {
                select: {
                    userID: true,
                    name: true,
                    number: true,
                },
            },
        },
    });

    const outstandingChainPromises = outstandingRows.map(p => ({
        promiseId: p.id,
        downstreamSalesRep: p.downstreamSalesRep,
        halfAmount: p.halfAmount,
        createdAt: p.createdAt,
    }));

    // asReferred inbound (informational only; no SR-side reward).
    const inboundReferrals = await prisma.referral.findMany({
        where: {
            referredSalesRepresentativeId: userId,
        },
        include: {
            referralCode: {
                include: {
                    salesRepresentative: {
                        select: {
                            userID: true,
                            name: true,
                            number: true,
                        },
                    },
                },
            },
        },
    });

    const asReferred: {
        inboundReferrals: Array<{
            referralId: string;
            fromSalesRep: {
                userID: string;
                name: string | null;
                number: string | null;
            } | null;
            createdAt: Date;
        }>;
    } = {
        inboundReferrals: inboundReferrals.map(r => ({
            referralId: r.id,
            fromSalesRep: r.referralCode.salesRepresentative
                ? {
                      userID: r.referralCode.salesRepresentative.userID,
                      name: r.referralCode.salesRepresentative.name,
                      number: r.referralCode.salesRepresentative.number,
                  }
                : null,
            createdAt: (r as any).createdAt ?? new Date(),
        })),
    };

    return {
        asReferred,
        asReferrer,
        chainBonuses,
        outstandingChainPromises,
    };
};

const claimReferralReward = async (
    user: JwtPayload,
    payload: IReferralClaim,
    tenantId?: string,
) => {
    const userId = user.userID;
    const {
        activeShopId,
        salesRepId,
        rewardId,
        rewardType,
        userType,
    } = payload;

    const isSRClaim = user.role === UserRole.SALES_REPRESENTATIVE;

    // Role / payload split
    if (isSRClaim) {
        if (activeShopId) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'Sales Representatives cannot claim with an activeShopId',
            );
        }
        if (!salesRepId) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'salesRepId is required for Sales Representative claims',
            );
        }
        if (salesRepId !== userId) {
            throw new ApiError(
                httpStatus.FORBIDDEN,
                'salesRepId must match the caller',
            );
        }
        // SR claims are forced to CREDITS
        if (rewardType !== 'CREDITS') {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'Sales Representatives can only claim CREDITS rewards',
            );
        }
    } else {
        if (salesRepId) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'Only Sales Representatives can claim with salesRepId',
            );
        }
        if (!activeShopId) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'activeShopId is required for Owner claims',
            );
        }
    }

    // Validate pointer side of reward matches caller
    const reward = await prisma.referralReward.findUnique({
        where: { id: rewardId },
    });

    if (!reward) {
        throw new ApiError(httpStatus.NOT_FOUND, 'REWARD_NOT_FOUND');
    }

    if (isSRClaim) {
        // SR-side: the reward must point to this SR on the referrer side
        // and must NOT have a shop pointer on that side.
        if (userType === 'referrer') {
            if (reward.referrerSalesRepId !== userId || reward.referrerShopId) {
                throw new ApiError(
                    httpStatus.BAD_REQUEST,
                    'REWARD_POINTER_MISMATCH',
                );
            }
        } else {
            // SR has no "referred" reward by design — only inbound referrals.
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'Sales Representatives have no referred reward to claim',
            );
        }
    } else {
        // Owner: the reward must point to caller's shop on the requested side.
        if (userType === 'referrer') {
            if (reward.referrerSalesRepId || !reward.referrerShopId) {
                throw new ApiError(
                    httpStatus.BAD_REQUEST,
                    'REWARD_POINTER_MISMATCH',
                );
            }
        } else {
            if (reward.referredSalesRepId || !reward.referredShopId) {
                throw new ApiError(
                    httpStatus.BAD_REQUEST,
                    'REWARD_POINTER_MISMATCH',
                );
            }
        }
    }

    const statusField =
        userType === 'referrer' ? 'referrerStatus' : 'referredStatus';
    if (reward[statusField] === 'CLAIMED') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'REWARD_ALREADY_CLAIMED');
    }

    // Apply the reward
    if (isSRClaim) {
        // SR-side claim: CREDITS only, route to SR wallet.
        const credits =
            userType === 'referrer'
                ? (reward.referrerCredits as number)
                : (reward.referredCredits as number);

        const isChainBonus = !!reward.chainBonusReferralId;
        const reason = isChainBonus
            ? 'REFERRAL_CHAIN_BONUS'
            : 'REFERRAL_REWARD';

        await prisma.$transaction(async tx => {
            await salesRepCreditService.upsertWalletAndAppendTopup(tx, {
                salesRepId: userId,
                credits,
                reason,
                refId: reward.id,
            });

            // Mark the matching side CLAIMED.
            // SR-side has no shop pointer on the reward row.
            const updateData: any = {
                updatedAt: new Date(),
                [statusField]: 'CLAIMED',
            };
            if (userType === 'referrer') {
                updateData.referrerClaimedAt = new Date();
            } else {
                updateData.referredClaimedAt = new Date();
            }
            await tx.referralReward.update({
                where: { id: reward.id },
                data: updateData,
            });
        });

        return {
            success: true,
            message: `Reward claimed successfully: CREDITS`,
            kind: 'SR_CREDITS',
        };
    }

    // Owner-side claim path (existing behavior, untouched).
    // Validate shop belongs to caller + tenant.
    const shop = await prisma.shop.findFirst({
        where: {
            id: activeShopId,
            ownerID: userId,
            tenantID: tenantId,
        },
        include: {
            CreditWallet: true,
        },
    });

    if (!shop) {
        throw new ApiError(httpStatus.NOT_FOUND, 'SHOP_NOT_FOUND');
    }

    // Validate reward belongs to tenant (one of the two sides).
    if (
        reward.referrerTenantId !== tenantId &&
        reward.referredTenantId !== tenantId
    ) {
        throw new ApiError(httpStatus.NOT_FOUND, 'REWARD_NOT_FOUND');
    }

    if (rewardType === 'SUBSCRIPTION_EXTENSION') {
        const activeSubscription = await prisma.subscription.findFirst({
            where: {
                shopId: activeShopId,
                tenantID: tenantId,
                status: 'ACTIVE',
                endDate: { gte: new Date() },
            },
        });
        if (!activeSubscription) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'No active subscription found',
            );
        }
    }

    if (rewardType === 'CREDITS') {
        const creditsAmount =
            userType === 'referrer'
                ? (reward.referrerCredits as number)
                : (reward.referredCredits as number);

        const shopId: string = activeShopId!;

        await prisma.$transaction(async tx => {
            const wallet = await tx.creditWallet.upsert({
                where: { shopId: shopId },
                update: {
                    totalCredits: { increment: creditsAmount },
                },
                create: {
                    totalCredits: creditsAmount,
                    usedCredits: 0,
                    shopId: shopId,
                    tenantID: tenantId,
                },
            });

            await tx.creditTopup.create({
                data: {
                    shopId: shopId,
                    walletId: wallet.id,
                    credits: creditsAmount,
                    tenantID: tenantId,
                },
            });

            await tx.shop.update({
                where: { id: activeShopId },
                data: {
                    credit: {
                        increment: creditsAmount,
                    },
                },
            });
        });
    } else if (rewardType === 'SUBSCRIPTION_EXTENSION') {
        const subDays =
            userType === 'referrer'
                ? (reward.referrerSubDays as number)
                : (reward.referredSubDays as number);

        const activeSubscription = await prisma.subscription.findFirst({
            where: {
                shopId: activeShopId,
                tenantID: tenantId,
                status: 'ACTIVE',
                endDate: { gte: new Date() },
            },
        });
        if (!activeSubscription) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'No active subscription found',
            );
        }

        const daysToAdd = subDays * 24 * 60 * 60 * 1000;
        const newEndDate = new Date(
            activeSubscription.endDate.getTime() + daysToAdd,
        );

        await prisma.subscription.update({
            where: { id: activeSubscription.id },
            data: {
                endDate: newEndDate,
            },
        });
    }

    const updateData: any = {
        updatedAt: new Date(),
    };
    if (userType === 'referrer') {
        updateData.referrerStatus = 'CLAIMED';
        updateData.referrerRewardType = rewardType;
        updateData.referrerClaimedAt = new Date();
        updateData.referrerShopId = activeShopId;
        updateData.referrerTenantId = tenantId;
    } else {
        updateData.referredStatus = 'CLAIMED';
        updateData.referredRewardType = rewardType;
        updateData.referredClaimedAt = new Date();
        updateData.referredShopId = activeShopId;
        updateData.referredTenantId = tenantId;
    }

    await prisma.referralReward.update({
        where: { id: rewardId },
        data: updateData,
    });

    return {
        success: true,
        message: `Reward claimed successfully: ${rewardType}`,
    };
};

export const referralService = {
    getAllReferralRewards,
    claimReferralReward,
};
