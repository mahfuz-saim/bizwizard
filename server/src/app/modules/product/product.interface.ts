import { LossType, LotDeletionReason, ProductCategory } from '@prisma/client';

export interface IProduct {
    productID?: string;
    variantId?: string;
    name: string;
    category: ProductCategory;
    variantName?: string;
    variantCode?: string;
    packOf?: number;
    shopID: string;
    lowStock?: number;
    lastSoldDate?: Date;
    notifyAfterNotSold?: number;
    notifyBeforeExp?: number;
    barcode?: string;
    measuringUnit: string;
    supplierId?: string;
    genericName?: string;
    lot: {
        stock: number;
        mrp: number;
        isMRPDefault: boolean;
        retail: number;
        includeVAT: boolean;
        buyPrice: number;
        sellPrice: number;
        vat?: number;
        mfgDate?: Date;
        expDate?: Date;
        locationAtStore?: string;
        note?: string;
    };
}

// Catalog create — product + N variants without lots (Option A)
export interface ICatalogVariant {
    variantName: string;
    variantCode?: string;
    packOf?: number;
    lowStock?: number;
    notifyAfterNotSold?: number;
    notifyBeforeExp?: number;
}

export interface ICreateCatalog {
    shopID: string;
    productID?: string; // if reusing existing Inventory
    name: string;
    category: ProductCategory;
    measuringUnit: string;
    barcode?: string;
    genericName?: string;
    variants: ICatalogVariant[];
}

export interface IUpdateLot {
    mrp?: number;
    isMRPDefault?: boolean;
    retail?: number;
    includeVAT?: boolean;
    sellPrice?: number;
    vat?: number;
    mfgDate?: Date;
    expDate?: Date | null;
    locationAtStore?: string;
    note?: string;
}

export interface IUpdateProduct {
    sellPrice?: number;
    expDate?: Date | null;
    name?: string;
    variantName?: string;
    variantCode?: string;
    packOf?: number;
    lowStock?: number;
    lastSoldDate?: Date;
    notifyAfterNotSold?: number;
}

export interface ILotDeletion {
    lotId: string;
    stock: number;
    reason: LotDeletionReason;
    lossType: LossType;
    lossAmount: number;
    note?: string;
}
