import {
    Prisma,
    UserRole,
    ShopJoinRequestStatus,
    ShopCategory,
    SubscriptionStatus,
} from '@prisma/client';
import { paginationHelpers } from '../../../helpers/paginationHelper';
import { JwtPayload } from '../../../interfaces/common';
import { IPaginationOptions } from '../../../interfaces/pagination';
import prisma from '../../../shared/prisma';
import {
    ICreateShop,
    IShopConfig,
    IUpdateEmployeeRequest,
    IUpdateShop,
} from './shop.interface';
import { nanoIdHelper } from '../../../helpers/nanoidHelper';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';

const createShop = async (user: JwtPayload, payload: ICreateShop) => {
    // Verify the user is actually a Customer (owner), or handle logic for Admin if needed
    const customer = await prisma.user.findUniqueOrThrow({
        where: {
            id: user.userID,
            role: {
                has: user.role,
            },
        },
        include: {
            Owner: {
                include: {
                    shops: {
                        select: {
                            id: true,
                        },
                    },
                },
            },
        },
    });

    const shopCode = await nanoIdHelper.generateShopCode(6);
    const result = await prisma.$transaction(async tx => {
        // Create the new shop, linking to the Customer's ID
        const tenant = await tx.tenant.create({
            data: {
                name: payload.shopName,
                ownerID: customer.Owner?.userID as string,
                code: shopCode,
            },
        });
        const result = await tx.shop.create({
            data: {
                shopName: payload.shopName,
                ownerID: customer.Owner?.userID as string,
                tenantID: tenant.id,
                contact: payload.contact,
                tradeLicense: payload.tradeLicense,
                shopCode: shopCode,
                category: payload.category,
                address: {
                    create: {
                        street: payload.address.street,
                        upazila: payload.address.upazila,
                        district: payload.address.district,
                        tenantID: tenant.id,
                    },
                },
                CreditWallet: {
                    create: {
                        tenantID: tenant.id,
                        totalCredits: 0,
                        usedCredits: 0,
                    },
                },
                shopConfig: {
                    create: {
                        tenantID: tenant.id,
                    },
                },
            },
        });

        const trialPlan = await tx.subscriptionPlan.findFirstOrThrow({
            where: {
                name: 'TRIAL',
                isActive: true,
            },
        });

        if (!customer.Owner?.shops || customer.Owner?.shops.length == 0) {
            const trialFeatures = trialPlan?.features as { [key: string]: any };
            const trialDays = trialFeatures.days as number;
            await tx.subscription.create({
                data: {
                    shopId: result.id,
                    tenantID: tenant.id,
                    subscriptionPlanId: trialPlan.id,
                    startDate: new Date(),
                    endDate: new Date(
                        Date.now() + trialDays * 24 * 60 * 60 * 1000,
                    ),
                    status: SubscriptionStatus.ACTIVE,
                },
            });
        }

        return result;
    });

    return result;
};

const getAllShop = async (
    user: JwtPayload,
    filters: { searchTerm?: string },
    options: IPaginationOptions,
) => {
    const { limit, page, skip, sortBy, sortOrder } =
        paginationHelpers.calculatePagination(options);
    const { searchTerm } = filters;

    // We build up an array of AND conditions
    const andConditions: Prisma.ShopWhereInput[] = [];

    if (user.role === UserRole.OWNER) {
        const userData = await prisma.user.findUnique({
            where: { id: user.userID },
            select: {
                Owner: {
                    select: { userID: true },
                },
            },
        });

        if (!userData?.Owner) {
            throw new Error('User does not have a customer record.');
        }

        andConditions.push({
            ownerID: userData.Owner.userID,
        });
    }

    // Searching across shop name, shop code and the owner's number.
    // NOTE: this used to be two separate `if (searchTerm)` blocks that pushed
    // two OR groups into `andConditions`; those groups are combined with AND,
    // so a search only matched when the shop name AND the owner's number both
    // contained the term. One OR group means "match any of these fields".
    if (searchTerm) {
        andConditions.push({
            OR: [
                {
                    shopName: {
                        contains: searchTerm,
                        mode: 'insensitive',
                    },
                },
                {
                    shopCode: {
                        contains: searchTerm,
                        mode: 'insensitive',
                    },
                },
                {
                    owner: {
                        number: {
                            contains: searchTerm,
                            mode: 'insensitive',
                        },
                    },
                },
            ],
        });
    }

    const whereConditions: Prisma.ShopWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

    const result = await prisma.shop.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy:
            sortBy && sortOrder
                ? { [sortBy]: sortOrder }
                : { createdAt: 'desc' },
        include: {
            Subscription: {
                where: {
                    status: SubscriptionStatus.ACTIVE,
                },
            },
        },
    });

    const total = await prisma.shop.count({
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

/**
 * Resolve a tenant to its shop(s), owner and active subscription(s).
 * Used by the admin dashboard's store-scope shell: it needs to validate a
 * tenant id coming from the URL without paging through `GET /shop`.
 * Global admin route — deliberately NOT behind verifyTenantAccess.
 */
const getShopsByTenant = async (tenantId: string) => {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
            owner: {
                select: {
                    userID: true,
                    name: true,
                    number: true,
                    email: true,
                    image: true,
                },
            },
        },
    });

    if (!tenant || tenant.isDeleted) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Store not found');
    }

    const shops = await prisma.shop.findMany({
        where: { tenantID: tenantId },
        include: {
            address: true,
            Subscription: {
                where: {
                    status: SubscriptionStatus.ACTIVE,
                },
                include: {
                    plan: true,
                    employeePlan: true,
                },
            },
        },
        orderBy: { createdAt: 'asc' },
    });

    return { tenant, shops };
};

const getProductInShop = async (
    shopId: string,
    filters: any,
    options: IPaginationOptions,
    tenantId: string,
) => {
    await prisma.shop.findFirstOrThrow({
        where: {
            id: shopId,
            tenantID: tenantId,
        },
        select: {
            id: true,
        },
    });

    const { limit, page, skip } =
        paginationHelpers.calculatePagination(options);
    let {
        searchTerm,
        supplierId,
        barcode = null,
        includeProduct = true,
        expireSoon = false,
        ...filterData
    } = filters;

    if (includeProduct === 'false') {
        includeProduct = false;
    }
    if (expireSoon === 'true') {
        expireSoon = true;
    }

    // STEP 1: Get sorted and filtered IDs from raw SQL with pagination
    // This query does:
    // 1. Filters by shopID
    // 2. Applies search term filter (name, variantCode, variantName)
    // 3. Applies barcode filter via inventory join
    // 4. Applies supplier filter via lot relation
    // 5. Applies expireSoon filter (lots expiring within notifyBeforeExp days)
    // 6. Sorts by earliest expiration date (nulls last)
    // 7. Applies pagination (LIMIT/OFFSET)
    const sortedIdsResult = await prisma.$queryRaw<{ id: string }[]>`
        SELECT sv.id
        FROM "shop_variants" sv
        LEFT JOIN "lot" l ON l."shopVariantId" = sv.id
        ${barcode || searchTerm ? Prisma.sql`LEFT JOIN "inventory" i ON sv."productID" = i.id` : Prisma.empty}
        WHERE sv."shopID" = ${shopId}
        AND sv."tenantID" = ${tenantId}
        ${
            searchTerm
                ? Prisma.sql`
            AND (
                sv.name ILIKE ${`%${searchTerm}%`}
                OR sv."variantCode" ILIKE ${`%${searchTerm}%`}
                OR sv."variantName" ILIKE ${`%${searchTerm}%`}
                OR i."genericName" ILIKE ${`%${searchTerm}%`}
            )
        `
                : Prisma.empty
        }
        ${barcode ? Prisma.sql`AND i.barcode = ${barcode}` : Prisma.empty}
        ${
            supplierId
                ? Prisma.sql`
            AND EXISTS (
                SELECT 1 
                FROM "lot" l_sup 
                WHERE l_sup."shopVariantId" = sv.id 
                AND l_sup."supplyId" = ${supplierId}
            )
        `
                : Prisma.empty
        }
        ${
            expireSoon
                ? Prisma.sql`
            AND EXISTS (
                SELECT 1 
                FROM "lot" l_exp 
                WHERE l_exp."shopVariantId" = sv.id 
                AND l_exp."expDate" IS NOT NULL
                AND l_exp."expDate" <= (CURRENT_DATE + (sv."notifyBeforeExp" || ' days')::INTERVAL)
            )
        `
                : Prisma.empty
        }
        GROUP BY sv.id ${barcode || searchTerm ? Prisma.sql`, i.id` : Prisma.empty}
        ORDER BY MIN(l."expDate") NULLS LAST
        LIMIT ${limit} OFFSET ${skip}
    `;

    const sortedIds = sortedIdsResult.map(r => r.id);

    if (sortedIds.length === 0) {
        return {
            meta: { total: 0, page, limit },
            data: [],
        };
    }

    // STEP 2: Fetch full variant data for the filtered and paginated IDs
    // Note: All filters already applied in SQL, so just fetch by IDs
    const variants = await prisma.shopVariant.findMany({
        where: {
            id: { in: sortedIds },
            tenantID: tenantId,
        },
        include: { product: includeProduct },
    });

    // STEP 3: Preserve SQL sort order (Prisma doesn't guarantee order with IN clause)
    const orderedVariants = sortedIds
        .map(id => variants.find(v => v.id === id))
        .filter(Boolean);

    // STEP 4: Get total count for pagination (using same filters as main query)
    const totalResult = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT sv.id) as count
        FROM "shop_variants" sv
        LEFT JOIN "lot" l ON l."shopVariantId" = sv.id
        ${barcode || searchTerm ? Prisma.sql`LEFT JOIN "inventory" i ON sv."productID" = i.id` : Prisma.empty}
        WHERE sv."shopID" = ${shopId}
        AND sv."tenantID" = ${tenantId}
        ${
            searchTerm
                ? Prisma.sql`
            AND (
                sv.name ILIKE ${`%${searchTerm}%`}
                OR sv."variantCode" ILIKE ${`%${searchTerm}%`}
                OR sv."variantName" ILIKE ${`%${searchTerm}%`}
                OR i."genericName" ILIKE ${`%${searchTerm}%`}
            )
        `
                : Prisma.empty
        }
        ${barcode ? Prisma.sql`AND i.barcode = ${barcode}` : Prisma.empty}
        ${
            supplierId
                ? Prisma.sql`
            AND EXISTS (
                SELECT 1 
                FROM "lot" l_sup 
                WHERE l_sup."shopVariantId" = sv.id 
                AND l_sup."supplyId" = ${supplierId}
            )
        `
                : Prisma.empty
        }
        ${
            expireSoon
                ? Prisma.sql`
            AND EXISTS (
                SELECT 1 
                FROM "lot" l_exp 
                WHERE l_exp."shopVariantId" = sv.id 
                AND l_exp."expDate" IS NOT NULL
                AND l_exp."expDate" <= (CURRENT_DATE + (sv."notifyBeforeExp" || ' days')::INTERVAL)
            )
        `
                : Prisma.empty
        }
    `;

    const total = Number(totalResult[0]?.count || 0);

    return {
        meta: { total, page, limit },
        data: orderedVariants,
    };
};

const deleteShop = async (user: JwtPayload, id: string, tenantId: string) => {
    // If Admin, can delete any shop
    if (user.role === UserRole.ADMIN) {
        await prisma.shop.deleteMany({
            where: {
                id,
                tenantID: tenantId,
            },
        });
    }
    // If Customer, can only delete shops they own
    else if (user.role === UserRole.OWNER) {
        // 1) Find the customer's ID
        const userData = await prisma.user.findUnique({
            where: { id: user.userID },
            select: {
                Owner: {
                    select: { userID: true },
                },
            },
        });
        if (!userData?.Owner) {
            throw new Error('User does not have a customer record.');
        }

        // 2) Delete only if shop belongs to this customer
        await prisma.shop.deleteMany({
            where: {
                id,
                ownerID: userData.Owner.userID,
                tenantID: tenantId,
            },
        });
    }
};

const updateShop = async (
    user: JwtPayload,
    id: string,
    payload: IUpdateShop,
    tenantId: string,
) => {
    const userData = await prisma.user.findUnique({
        where: { id: user.userID },
        select: {
            Owner: {
                select: { userID: true },
            },
        },
    });

    if (!userData?.Owner) {
        throw new Error('User does not have a Owner record.');
    }

    const existingShop = await prisma.shop.findFirstOrThrow({
        where: {
            id,
            ownerID: userData.Owner.userID,
            tenantID: tenantId,
        },
        select: {
            id: true,
        },
    });

    const updateResult = await prisma.shop.update({
        where: {
            id: existingShop.id,
        },
        data: payload,
    });

    return updateResult;
};

const getEmployeeRequests = async (shopId: string, tenantId: string) => {
    const result = await prisma.shopJoinRequest.findMany({
        where: {
            shopID: shopId,
            tenantID: tenantId,
            status: ShopJoinRequestStatus.PENDING,
        },
        include: {
            User: true,
        },
    });
    return result;
};

const updateEmployeeRequest = async (
    payload: IUpdateEmployeeRequest,
    tenantId: string,
) => {
    //check total active employees
    const totalActiveEmployees = await prisma.employee.count({
        where: {
            shopID: payload.shopId,
            tenantID: tenantId,
            isDeleted: false,
        },
    });

    // check subscriptionPlan
    const subscriptionPlan = await prisma.subscription.findFirst({
        where: {
            shopId: payload.shopId,
            tenantID: tenantId,
            status: SubscriptionStatus.ACTIVE,
        },
    });

    if (subscriptionPlan?.employeeSlots === totalActiveEmployees) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            'You have reached the maximum number of employees allowed by your subscription plan.',
        );
    }

    await prisma.shopJoinRequest.findFirstOrThrow({
        where: {
            shopID: payload.shopId,
            userID: payload.employeeId,
            tenantID: tenantId,
        },
    });

    const result = await prisma.$transaction(async tx => {
        const result = await tx.shopJoinRequest.update({
            where: {
                shopID_userID: {
                    shopID: payload.shopId,
                    userID: payload.employeeId,
                },
            },
            data: {
                status: payload.status,
            },
        });
        if (payload.status === ShopJoinRequestStatus.ACCEPTED) {
            const updatedEmployee = await tx.employee.updateMany({
                where: {
                    userID: payload.employeeId,
                },
                data: {
                    shopID: payload.shopId,
                    tenantID: tenantId,
                },
            });

            if (updatedEmployee.count === 0) {
                throw new ApiError(
                    httpStatus.NOT_FOUND,
                    'Employee not found in this tenant.',
                );
            }
        }
        return result;
    });
    return result;
};

const getShopInfo = async (shopId: string, tenantId: string) => {
    const shop = await prisma.shop.findFirstOrThrow({
        where: {
            id: shopId,
            tenantID: tenantId,
        },
    });

    const subscription = await prisma.subscription.findFirst({
        where: {
            shopId: shopId,
            tenantID: tenantId,
            status: SubscriptionStatus.ACTIVE,
        },
    });
    const result = {
        ...shop,
        subscription: subscription || null,
    };

    return result;
};

const verifyShopCode = async (shopCode: string) => {
    const shop = await prisma.shop.findFirst({
        where: {
            shopCode,
        },
        select: {
            id: true,
            shopName: true,
            contact: true,
            category: true,
            shopCode: true,
            tenantID: true,
            address: true,
        },
    });

    if (!shop) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
    }

    return shop;
};

const getAllCategory = () => {
    const result = Object.values(ShopCategory);
    return result;
};

const getAllPlans = async () => {
    const result = await prisma.subscriptionPlan.findMany({
        where: {
            isActive: true,
        },
    });
    return result;
};

const getAllLotInShop = async (
    shopId: string,
    options: IPaginationOptions,
    tenantId: string,
) => {
    const { limit, page, skip, sortBy, sortOrder } =
        paginationHelpers.calculatePagination(options);

    const result = await prisma.lot.findMany({
        where: {
            tenantID: tenantId,
            ShopVariant: {
                shopID: shopId,
                tenantID: tenantId,
            },
        },
        take: limit,
        skip: skip,
        orderBy: { createdAt: 'desc' },
    });
    const total = await prisma.lot.count({
        where: {
            tenantID: tenantId,
            ShopVariant: {
                shopID: shopId,
                tenantID: tenantId,
            },
        },
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

const createShopConfig = async (payload: IShopConfig, tenantId: string) => {
    await prisma.shop.findFirstOrThrow({
        where: {
            id: payload.shopId,
            tenantID: tenantId,
        },
        select: {
            id: true,
        },
    });

    const data = {
        ...(payload.defaultExpirationThreshold !== undefined && {
            defaultExpirationThreshold: payload.defaultExpirationThreshold,
        }),
        ...(payload.defaultNotSoldThreshold !== undefined && {
            defaultNotSoldThreshold: payload.defaultNotSoldThreshold,
        }),
        ...(payload.defaultLowStockThreshold !== undefined && {
            defaultLowStockThreshold: payload.defaultLowStockThreshold,
        }),
    };

    const result = await prisma.shopConfig.upsert({
        where: {
            shopID: payload.shopId,
        },
        update: data,
        create: {
            shopID: payload.shopId,
            tenantID: tenantId,
            ...data,
        },
    });

    return result;
};
const getShopConfig = async (shopId: string, tenantId: string) => {
    const result = await prisma.shopConfig.findFirst({
        where: {
            shopID: shopId,
            tenantID: tenantId,
        },
    });
    return result;
};

export const shopService = {
    createShop,
    getAllShop,
    getShopsByTenant,
    getProductInShop,
    deleteShop,
    updateShop,
    getEmployeeRequests,
    updateEmployeeRequest,
    getShopInfo,
    verifyShopCode,
    getAllCategory,
    getAllPlans,
    getAllLotInShop,
    createShopConfig,
    getShopConfig,
};
