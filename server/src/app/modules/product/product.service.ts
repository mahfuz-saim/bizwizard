import prisma from '../../../shared/prisma';
import {
    ICreateCatalog,
    ILotDeletion,
    IProduct,
    IUpdateLot,
    IUpdateProduct,
} from './product.interface';
import { ExpenseType, LotStatus } from '@prisma/client';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';
import { JwtPayload } from '../../../interfaces/common';
import { nanoIdHelper } from '../../../helpers/nanoidHelper';
import { notificationService } from '../notification/notification.service';
import { SyncTriggerPayload } from '../../../interfaces/notificationPayload';

const getTenantShopOrThrow = async (shopId: string, tenantId: string) => {
    const shop = await prisma.shop.findFirst({
        where: {
            id: shopId,
            tenantID: tenantId,
        },
    });

    if (!shop) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
    }

    return shop;
};

const getTenantVariantOrThrow = async (variantId: string, tenantId: string) => {
    const variant = await prisma.shopVariant.findFirst({
        where: {
            id: variantId,
            tenantID: tenantId,
        },
    });

    if (!variant) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Product variant not found');
    }

    return variant;
};

const getTenantLotOrThrow = async (lotId: string, tenantId: string) => {
    const lot = await prisma.lot.findFirst({
        where: {
            id: lotId,
            tenantID: tenantId,
        },
    });

    if (!lot) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Lot not found');
    }

    return lot;
};

const addProductInShop = async (payload: IProduct, tenantId: string) => {
    let {
        lot,
        barcode,
        measuringUnit,
        variantId,
        supplierId,
        category,
        genericName,
        ...productData
    } = payload;
    const shop = await getTenantShopOrThrow(productData.shopID, tenantId);
    let supplyId: string | null = null;

    barcode = barcode || (await nanoIdHelper.generateCustomBarCode());

    if (supplierId) {
        await prisma.supplier.findUniqueOrThrow({
            where: {
                userID: supplierId,
            },
        });
        const supply = await prisma.shopSupplier.findFirst({
            where: {
                shopId: shop.id,
                supplierId: supplierId,
                tenantID: tenantId,
            },
        });
        supplyId = supply?.id ?? null;
    }

    if (variantId) {
        const existingVariant = await prisma.shopVariant.findFirst({
            where: {
                id: variantId,
                tenantID: tenantId,
                shopID: shop.id,
            },
        });

        if (!existingVariant) {
            throw new ApiError(
                httpStatus.NOT_FOUND,
                'Product variant not found',
            );
        }
    }

    // set notify date for expiration and not sold
    const shopConfig = await prisma.shopConfig.findFirst({
        where: {
            shopID: payload.shopID,
            tenantID: tenantId,
        },
    });

    if (!productData?.notifyAfterNotSold) {
        productData.notifyAfterNotSold = shopConfig?.defaultNotSoldThreshold;
    }
    if (!productData?.notifyBeforeExp) {
        productData.notifyBeforeExp = shopConfig?.defaultExpirationThreshold;
    }
    if (!productData?.lowStock) {
        productData.lowStock = shopConfig?.defaultLowStockThreshold;
    }

    const result = await prisma.$transaction(async tx => {
        let product = await tx.inventory.findUnique({
            where: {
                id: productData.productID || '',
            },
        });

        if (!product) {
            // handle no barcode
            const newBarcode = `${barcode}-custom-${shop.shopCode}`;
            product = await tx.inventory.create({
                data: {
                    productName: payload.name,
                    barcode: newBarcode,
                    measuringUnit: payload.measuringUnit,
                    category: category,
                    genericName: payload?.genericName || null,
                },
            });
            variantId = '';
        }
        productData.productID = product.id;
        const result = await tx.shopVariant.upsert({
            create: {
                ...productData,
                tenantID: tenantId,
                totalProducts: lot.stock,
                Lot: {
                    create: {
                        ...lot,
                        supplyId: supplyId,
                        tenantID: tenantId,
                    },
                },
            },
            update: {
                ...productData,
                totalProducts: {
                    increment: lot.stock,
                },
                Lot: {
                    create: {
                        ...lot,
                        supplyId: supplyId,
                        tenantID: tenantId,
                    },
                },
            },
            where: {
                id: variantId || '',
            },
            include: {
                Lot: true,
            },
        });

        if (supplyId) {
            await tx.shopSupplier.update({
                where: {
                    id: supplyId,
                },
                data: {
                    lastSuppliedAt: new Date(),
                },
            });
        }

        const date = new Date();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();

        await tx.expense.upsert({
            where: {
                shopID_year_month: {
                    shopID: shop.id,
                    year,
                    month,
                },
            },
            create: {
                shopID: shop.id,
                tenantID: tenantId,
                month,
                year,
                totalAmount: lot.buyPrice * lot.stock,
                ExpenseItem: {
                    create: {
                        tenantID: tenantId,
                        amount: lot.buyPrice * lot.stock,
                        name: productData.name,
                        expenseType: ExpenseType.PRODUCT,
                        shopVariantId: result.id,
                        lotId: result.Lot[0].id,
                        supplierId: supplyId,
                        quantity: lot.stock,
                        unitPrice: lot.buyPrice,
                    },
                },
            },
            update: {
                totalAmount: {
                    increment: lot.buyPrice * lot.stock,
                },
                ExpenseItem: {
                    create: {
                        tenantID: tenantId,
                        amount: lot.buyPrice * lot.stock,
                        name: productData.name,
                        expenseType: ExpenseType.PRODUCT,
                        shopVariantId: result.id,
                        lotId: result.Lot[0].id,
                        supplierId: supplyId,
                        quantity: lot.stock,
                        unitPrice: lot.buyPrice,
                    },
                },
            },
        });

        return result;
    });

    // sending notification to users
    await notificationService.sendSyncTrigger(
        [
            {
                dataType: 'SYNC',
                data: [
                    {
                        id: result.id,
                        entity: 'VARIANT',
                        operation: 'UPDATE',
                        updatedAt: result.updatedAt.toISOString(),
                    },
                    {
                        id: result.Lot[0].id,
                        entity: 'LOT',
                        operation: 'UPDATE',
                        updatedAt: result.updatedAt.toISOString(),
                    },
                ],
            },
        ],
        result.shopID,
    );

    return result;
};

// Catalog create — product + N variants without lots (Option A, totalProducts=0, no Expense)
const createProductWithVariants = async (
    payload: ICreateCatalog,
    tenantId: string,
) => {
    const { shopID, productID, name, category, measuringUnit, barcode, genericName, variants } = payload;

    const shop = await getTenantShopOrThrow(shopID, tenantId);

    let effectiveBarcode: string = barcode || (await nanoIdHelper.generateCustomBarCode());

    // ShopConfig defaults for variant thresholds
    const shopConfig = await prisma.shopConfig.findFirst({
        where: { shopID, tenantID: tenantId },
    });

    const result = await prisma.$transaction(async tx => {
        let product = null as any;

        if (productID) {
            product = await tx.inventory.findUnique({ where: { id: productID } });
            if (!product) {
                throw new ApiError(httpStatus.NOT_FOUND, 'Product not found for given productID');
            }
        } else if (effectiveBarcode) {
            // reuse existing Inventory by exact barcode if it exists (public catalog)
            product = await tx.inventory.findUnique({ where: { barcode: effectiveBarcode } });
        }

        if (!product) {
            // create new Inventory — mirror addProductInShop barcode handling
            const newBarcode = effectiveBarcode.includes('-custom-')
                ? effectiveBarcode
                : `${effectiveBarcode}-custom-${shop.shopCode}`;
            product = await tx.inventory.create({
                data: {
                    productName: name,
                    barcode: newBarcode,
                    measuringUnit,
                    category,
                    genericName: genericName || null,
                },
            });
        }

        const createdVariants: any[] = [];
        for (const v of variants) {
            const variantCode = v.variantCode && v.variantCode.trim() !== '' ? v.variantCode.trim() : null;
            // apply ShopConfig defaults if missing
            const lowStock = v.lowStock ?? shopConfig?.defaultLowStockThreshold ?? undefined;
            const notifyAfterNotSold = v.notifyAfterNotSold ?? shopConfig?.defaultNotSoldThreshold ?? undefined;
            const notifyBeforeExp = v.notifyBeforeExp ?? shopConfig?.defaultExpirationThreshold ?? undefined;

            // packOf defaults to 1 if not provided
            const packOf = v.packOf ?? 1;

            const created = await tx.shopVariant.create({
                data: {
                    productID: product.id,
                    name,
                    shopID: shop.id,
                    tenantID: tenantId,
                    variantName: v.variantName,
                    variantCode,
                    packOf,
                    lowStock: lowStock as any,
                    notifyAfterNotSold: notifyAfterNotSold as any,
                    notifyBeforeExp: notifyBeforeExp as any,
                    totalProducts: 0,
                },
            });
            createdVariants.push(created);
        }

        return { product, variants: createdVariants };
    });

    // Sync trigger for each variant
    const syncData = result.variants.map(v => ({
        id: v.id,
        entity: 'VARIANT' as const,
        operation: 'UPDATE' as const,
        updatedAt: (v.updatedAt as Date).toISOString(),
    }));

    if (syncData.length) {
        await notificationService.sendSyncTrigger(
            [{ dataType: 'SYNC', data: syncData }],
            shopID,
        );
    }

    return result;
};

const deleteProductFromShop = async (productID: string, tenantId: string) => {
    await getTenantVariantOrThrow(productID, tenantId);

    // const deleted = await prisma.shopVariant.delete({
    //     where: {
    //         id: productID,
    //     },
    // });
    //TODO: need to rethink this
    //hard deleter or soft delete?
    //cascade to nested tables
    //

    const deleted = null;

    // //NOTE: sending notification to users
    // await notificationService.sendSyncTrigger(
    //     {
    //         id: result.id,
    //         entity: 'VARIANT',
    //         operation: 'DELETE',
    //         updatedAt: result.updatedAt.toISOString(),
    //     },
    //     result.shopID,
    // );
    return deleted;
};

const updateProductInShop = async (
    productId: string,
    payload: IUpdateProduct,
    tenantId: string,
) => {
    await getTenantVariantOrThrow(productId, tenantId);

    const result = await prisma.shopVariant.update({
        where: {
            id: productId,
        },
        data: payload,
    });

    //NOTE: sending notification to users
    await notificationService.sendSyncTrigger(
        [
            {
                dataType: 'SYNC',
                data: [
                    {
                        id: result.id,
                        entity: 'VARIANT',
                        operation: 'UPDATE',
                        updatedAt: result.updatedAt.toISOString(),
                    },
                ],
            },
        ],
        result.shopID,
    );

    return result;
};

const updateLotInShop = async (
    lotId: string,
    payload: IUpdateLot,
    tenantId: string,
) => {
    const lot = await getTenantLotOrThrow(lotId, tenantId);

    const result = await prisma.lot.update({
        where: {
            id: lot.id,
        },
        data: payload,
    });

    const shopVariant = await getTenantVariantOrThrow(
        result.shopVariantId,
        tenantId,
    );

    //NOTE: sending notification to users
    await notificationService.sendSyncTrigger(
        [
            {
                dataType: 'SYNC',
                data: [
                    {
                        id: result.id,
                        entity: 'LOT',
                        operation: 'UPDATE',
                        updatedAt: result.updatedAt.toISOString(),
                    },
                ],
            },
        ],
        shopVariant.shopID,
    );

    return result;
};
const getAllLotsInShop = async (variantId: string, tenantId: string) => {
    await getTenantVariantOrThrow(variantId, tenantId);

    const result = await prisma.lot.findMany({
        where: {
            shopVariantId: variantId,
            tenantID: tenantId,
            status: LotStatus.ACTIVE,
        },
    });
    return result;
};

const deleteLotInShop = async (
    payload: ILotDeletion,
    user: JwtPayload,
    tenantId: string,
) => {
    const lot = await getTenantLotOrThrow(payload.lotId, tenantId);

    // Validate stock amount
    if (payload.stock > lot.stock) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Cannot delete ${payload.stock} items. Only ${lot.stock} items available in lot`,
        );
    }

    // Validate loss amount based on loss type
    const totalCost = payload.stock * lot.buyPrice;
    if (payload.lossType === 'FULL_LOSS') {
        if (payload.lossAmount !== totalCost) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                `For FULL_LOSS, lossAmount must equal ${totalCost} (stock * buyPrice)`,
            );
        }
    } else if (payload.lossType === 'PARTIAL_LOSS') {
        if (payload.lossAmount <= 0 || payload.lossAmount >= totalCost) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                `For PARTIAL_LOSS, lossAmount must be between 0 and ${totalCost}`,
            );
        }
    } else if (payload.lossType === 'NO_LOSS') {
        if (payload.lossAmount !== 0) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'For NO_LOSS, lossAmount must be 0',
            );
        }
    }

    const isFullDeletion = payload.stock === lot.stock;

    const [result, variant, updatedLot] = await prisma.$transaction(
        async tx => {
            const deletion = await tx.lotDeletion.create({
                data: {
                    lotId: payload.lotId,
                    shopVariantId: lot.shopVariantId,
                    tenantID: tenantId,
                    stock: payload.stock,
                    buyPrice: lot.buyPrice,
                    lossType: payload.lossType,
                    reason: payload.reason,
                    lossAmount: payload.lossAmount,
                    note: payload.note,
                    deletedByType: user.role,
                    deletedByEmployeeId:
                        user.role === 'EMPLOYEE' ? user.userID : null,
                    deletedByOwnerId:
                        user.role === 'OWNER' ? user.userID : null,
                },
            });

            let lotUpdate;
            if (isFullDeletion) {
                // Full deletion - mark lot as DELETED
                lotUpdate = await tx.lot.update({
                    where: {
                        id: lot.id,
                    },
                    data: {
                        status: 'DELETED',
                    },
                });
            } else {
                // Partial deletion - reduce stock but keep ACTIVE
                lotUpdate = await tx.lot.update({
                    where: {
                        id: lot.id,
                    },
                    data: {
                        stock: {
                            decrement: payload.stock,
                        },
                    },
                });
            }

            const variantUpdate = await tx.shopVariant.update({
                where: {
                    id: lot.shopVariantId,
                },
                data: {
                    totalProducts: {
                        decrement: payload.stock,
                    },
                },
            });
            return [deletion, variantUpdate, lotUpdate];
        },
    );

    //NOTE: sending notification to users
    await notificationService.sendSyncTrigger(
        [
            {
                dataType: 'SYNC',
                data: [
                    {
                        id: updatedLot.id,
                        entity: 'LOT',
                        operation: isFullDeletion ? 'DELETE' : 'UPDATE',
                        updatedAt: updatedLot.updatedAt.toISOString(),
                    },
                    {
                        id: variant.id,
                        entity: 'VARIANT',
                        operation: 'UPDATE',
                        updatedAt: variant.updatedAt.toISOString(),
                    },
                ],
            },
        ],
        variant.shopID,
    );
    return result;
};

const getProductByVariantCode = async (
    variantCode: string,
    shopId: string,
    tenantId: string,
) => {
    await getTenantShopOrThrow(shopId, tenantId);

    const result = await prisma.shopVariant.findFirstOrThrow({
        where: {
            shopID: shopId,
            variantCode: variantCode,
            tenantID: tenantId,
        },
        include: {
            Lot: true,
            product: true,
        },
    });

    return result;
};

const getProductByOCR = async (
    shopId: string,
    searchTerm: string[],
    tenantId: string,
) => {
    let shopVariants: any = [];

    await getTenantShopOrThrow(shopId, tenantId);

    const products = await prisma.inventory.findMany({
        where: {
            OR: searchTerm.map(term => ({
                OR: [
                    {
                        productName: {
                            contains: term,
                            mode: 'insensitive',
                        },
                    },
                    {
                        genericName: {
                            contains: term,
                            mode: 'insensitive',
                        },
                    },
                ],
            })),
        },
    });

    if (!products.length) {
        shopVariants = await prisma.shopVariant.findMany({
            where: {
                AND: [
                    { shopID: shopId },
                    { tenantID: tenantId },
                    {
                        OR: searchTerm.map(term => ({
                            variantName: {
                                contains: term,
                                mode: 'insensitive',
                            },
                        })),
                    },
                ],
            },
        });
    }

    return {
        products: products,
        shopVariants: shopVariants,
    };
};

const getProductById = async (productId: string, tenantId: string) => {
    const result = await prisma.inventory.findFirst({
        where: {
            id: productId,
            OR: [
                { isPrivate: false },
                {
                    shopVariants: {
                        some: {
                            tenantID: tenantId,
                        },
                    },
                },
            ],
        },
    });
    return result;
};

const getProductByVariantId = async (variantId: string, tenantId: string) => {
    const result = await prisma.shopVariant.findFirstOrThrow({
        where: {
            id: variantId,
            tenantID: tenantId,
        },
        include: {
            Lot: true,
            product: true,
        },
    });

    return result;
};

const getSingleLotInShop = async (lotId: string, tenantId: string) => {
    const result = await prisma.lot.findFirstOrThrow({
        where: {
            id: lotId,
            tenantID: tenantId,
        },
    });

    return result;
};

export const productService = {
    addProductInShop,
    createProductWithVariants,
    deleteProductFromShop,
    updateProductInShop,
    updateLotInShop,
    getAllLotsInShop,
    deleteLotInShop,
    getProductByVariantId,
    getProductByVariantCode,
    getProductByOCR,
    getProductById,
    getSingleLotInShop,
};
