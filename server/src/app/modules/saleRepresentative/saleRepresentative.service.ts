import { Prisma, SalesRepresentative, UserStatus } from '@prisma/client';
import { paginationHelpers } from '../../../helpers/paginationHelper';
import { IPaginationOptions } from '../../../interfaces/pagination';
import { ISalesRepresentativeFilterRequest } from './saleRepresentative.interface';
import prisma from '../../../shared/prisma';
import { IGenericResponse } from '../../../interfaces/common';
import { IUploadFile } from '../../../interfaces/file';
import { FileUploadHelper } from '../../../helpers/fileUploadHelper';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';

const getAllSalesRepresentatives = async (
    filters: ISalesRepresentativeFilterRequest,
    options: IPaginationOptions,
    tenantId: string,
): Promise<IGenericResponse<SalesRepresentative[]>> => {
    const { limit, page, skip, sortBy, sortOrder } =
        paginationHelpers.calculatePagination(options);
    const { searchTerm, ...filterData } = filters;

    const andConditions = [];

    if (searchTerm) {
        andConditions.push({
            OR: ['name', 'number', 'ReferralCode'].map(field => ({
                [field]: {
                    contains: searchTerm,
                    mode: 'insensitive',
                },
            })),
        });
    }

    if (Object.keys(filterData).length > 0) {
        andConditions.push({
            AND: Object.keys(filterData).map(key => ({
                [key]: {
                    equals: (filterData as any)[key],
                },
            })),
        });
    }

    andConditions.push({
        isDeleted: false,
    });

    andConditions.push({
        ReferralCode: {
            Referrals: {
                some: {
                    rewards: {
                        some: {
                            OR: [
                                {
                                    referredTenantId: tenantId,
                                },
                                {
                                    referrerTenantId: tenantId,
                                },
                            ],
                        },
                    },
                },
            },
        },
    });

    const whereConditions: Prisma.SalesRepresentativeWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

    const result = await prisma.salesRepresentative.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy:
            sortBy && sortOrder
                ? { [sortBy]: sortOrder }
                : { createdAt: 'desc' },
    });

    const total = await prisma.salesRepresentative.count({
        where: whereConditions,
    });

    return {
        meta: {
            total,
            page,
            limit,
        },
        data: result,
    };
};

const getSalesRepresentativeByID = async (id: string, tenantId: string) => {
    const result = await prisma.salesRepresentative.findFirst({
        where: {
            userID: id,
            isDeleted: false,
            ReferralCode: {
                Referrals: {
                    some: {
                        rewards: {
                            some: {
                                OR: [
                                    {
                                        referredTenantId: tenantId,
                                    },
                                    {
                                        referrerTenantId: tenantId,
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        },
    });

    return result;
};

const getSalesRepresentativeByReferralCode = async (
    referralCode: string,
    tenantId: string,
) => {
    const result = await prisma.salesRepresentative.findFirst({
        where: {
            ReferralCode: {
                code: {
                    equals: referralCode,
                },
                Referrals: {
                    some: {
                        rewards: {
                            some: {
                                OR: [
                                    {
                                        referredTenantId: tenantId,
                                    },
                                    {
                                        referrerTenantId: tenantId,
                                    },
                                ],
                            },
                        },
                    },
                },
            },
            isDeleted: false,
        },
    });

    return result;
};

const deleteSalesRepresentative = async (id: string, tenantId: string) => {
    const salesRepresentative = await prisma.salesRepresentative.findFirst({
        where: {
            userID: id,
            isDeleted: false,
            ReferralCode: {
                Referrals: {
                    some: {
                        rewards: {
                            some: {
                                OR: [
                                    {
                                        referredTenantId: tenantId,
                                    },
                                    {
                                        referrerTenantId: tenantId,
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        },
    });

    if (!salesRepresentative) {
        throw new ApiError(
            httpStatus.NOT_FOUND,
            'Sales representative not found',
        );
    }

    await prisma.$transaction(async tx => {
        await tx.salesRepresentative.update({
            where: {
                userID: id,
            },
            data: {
                isDeleted: true,
            },
        });

        await tx.user.update({
            where: {
                id,
            },
            data: {
                status: UserStatus.DELETED,
            },
        });
    });

    return {
        message: 'Sales representative is deleted',
    };
};

const updateSalesRepresentative = async (
    id: string,
    payload: { name?: string; image?: string },
    file: IUploadFile,
    tenantId: string,
) => {
    const salesRepresentative = await prisma.salesRepresentative.findFirst({
        where: {
            userID: id,
            isDeleted: false,
            ReferralCode: {
                Referrals: {
                    some: {
                        rewards: {
                            some: {
                                OR: [
                                    {
                                        referredTenantId: tenantId,
                                    },
                                    {
                                        referrerTenantId: tenantId,
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        },
    });

    if (!salesRepresentative) {
        throw new ApiError(
            httpStatus.NOT_FOUND,
            'Sales representative not found',
        );
    }

    if (file) {
        const uploadedProfileImage =
            await FileUploadHelper.uploadToCloudinary(file);
        payload.image = uploadedProfileImage?.secure_url;
    }

    const result = await prisma.salesRepresentative.update({
        where: {
            userID: id,
        },
        data: payload,
    });

    return result;
};

export const salesRepresentativeService = {
    getAllSalesRepresentatives,
    getSalesRepresentativeByID,
    getSalesRepresentativeByReferralCode,
    deleteSalesRepresentative,
    updateSalesRepresentative,
};
