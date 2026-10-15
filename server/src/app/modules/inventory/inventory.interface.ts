import { ProductCategory } from '@prisma/client';

export interface IInventory {
    productName: string;
    barcode: string;
    measuringUnit: string;
    image?: string;
    category: ProductCategory;
    genericName?: string;
}

export interface IInventorySearchField {
    searchTerm?: string;
    productName?: string;
    barcode?: string;
    buyPrice?: number;
    sellPrice?: number;
    genericName?: string;
}
