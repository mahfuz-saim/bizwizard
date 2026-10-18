import prisma from '../../../shared/prisma';
import {
    ICreateCatalog,
    ILotDeletion,
    IProduct,
    IUpdateLot,
    IUpdateProduct,
} from './product.interface';
import { ExpenseType, LotStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
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

const addProductInShop = async (payload: IProduct, tenantId: string, transaction?: Prisma.TransactionClient) => {
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
        if (!supplyId) throw new ApiError(httpStatus.BAD_REQUEST, 'Select a supplier linked to this shop');
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
        productData.productID = existingVariant.productID ?? undefined;
        productData.name = existingVariant.name ?? payload.name;
    }

    // set notify date for expiration and not sold
    const shopConfig = await prisma.shopConfig.findFirst({
        where: {
            shopID: payload.shopID,
            tenantID: tenantId,
        },
    });

    if (productData.notifyAfterNotSold === undefined) {
        productData.notifyAfterNotSold = shopConfig?.defaultNotSoldThreshold;
    }
    if (productData.notifyBeforeExp === undefined) {
        productData.notifyBeforeExp = shopConfig?.defaultExpirationThreshold;
    }
    if (productData.lowStock === undefined) {
        productData.lowStock = shopConfig?.defaultLowStockThreshold;
    }

    const lotId = randomUUID();
    const write = async (tx: Prisma.TransactionClient) => {
        let product = await tx.inventory.findUnique({
            where: {
                id: productData.productID || '',
            },
        });

        if (!product) {
            if (variantId) throw new ApiError(httpStatus.BAD_REQUEST, 'Existing variant has no catalog product. Repair its catalog link before restocking.');
            if (!payload.name?.trim() || !measuringUnit?.trim()) {
                throw new ApiError(httpStatus.BAD_REQUEST, 'Product name and measuring unit are required');
            }
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
                        id: lotId,
                        expDate: lot.expDate ? new Date(lot.expDate) : undefined,
                        mfgDate: lot.mfgDate ? new Date(lot.mfgDate) : undefined,
                        supplyId: supplyId,
                        tenantID: tenantId,
                    },
                },
            },
            update: {
                totalProducts: {
                    increment: lot.stock,
                },
                Lot: {
                    create: {
                        ...lot,
                        id: lotId,
                        expDate: lot.expDate ? new Date(lot.expDate) : undefined,
                        mfgDate: lot.mfgDate ? new Date(lot.mfgDate) : undefined,
                        supplyId: supplyId,
                        tenantID: tenantId,
                    },
                },
            },
            where: {
                id: variantId || '',
            },
            include: {
                Lot: { where: { id: lotId } },
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
    };
    const result = transaction ? await write(transaction) : await prisma.$transaction(write);

    // sending notification to users
    if (!transaction) await notificationService.sendSyncTrigger(
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
    ).catch(() => console.warn('Inventory saved; sync notification could not be delivered.'));

    return result;
};

const addPurchase = async (lines: IProduct[], tenantId: string) => {
    const results = await prisma.$transaction(async tx => {
        const results = [];
        for (const line of lines) results.push(await addProductInShop(line, tenantId, tx));
        return results;
    }, { timeout: 30000 });
    await notificationService.sendSyncTrigger([{ dataType: 'SYNC', data: results.flatMap(result => [
        { id: result.id, entity: 'VARIANT' as const, operation: 'UPDATE' as const, updatedAt: result.updatedAt.toISOString() },
        { id: result.Lot[0].id, entity: 'LOT' as const, operation: 'UPDATE' as const, updatedAt: result.updatedAt.toISOString() },
    ]) }], lines[0].shopID).catch(() => console.warn('Purchase saved; sync notification could not be delivered.'));
    return results;
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

    const { sellPrice, expDate, ...variantData } = payload;
    const updatedLots: SyncTriggerPayload[] = [];
    const result = await prisma.$transaction(async tx => {
        const variant = await tx.shopVariant.update({ where: { id: productId }, data: variantData });
        if (sellPrice !== undefined || expDate !== undefined) {
            await tx.lot.updateMany({ where: { shopVariantId: productId, tenantID: tenantId, stock: { gt: 0 }, status: LotStatus.ACTIVE },
                data: { sellPrice, retail: sellPrice, mrp: sellPrice,
                    expDate: expDate === null ? null : expDate ? new Date(expDate) : undefined },
            });
            const lots = await tx.lot.findMany({ where: { shopVariantId: productId, tenantID: tenantId, stock: { gt: 0 }, status: LotStatus.ACTIVE }, select: { id: true, updatedAt: true } });
            updatedLots.push(...lots.map(lot => ({ id: lot.id, entity: 'LOT' as const, operation: 'UPDATE' as const, updatedAt: lot.updatedAt.toISOString() })));
        }
        return variant;
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
                    ...updatedLots,
                ],
            },
        ],
        result.shopID,
    ).catch(() => console.warn('Product updated; sync notification could not be delivered.'));

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
        data: { ...payload,
            expDate: payload.expDate === null ? null : payload.expDate ? new Date(payload.expDate) : undefined,
            mfgDate: payload.mfgDate ? new Date(payload.mfgDate) : undefined,
        },
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
    addPurchase,
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
