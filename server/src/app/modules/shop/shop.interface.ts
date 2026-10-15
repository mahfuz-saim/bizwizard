import { ShopCategory } from '@prisma/client';
interface ShopAddress {
    street: string;
    upazila: string;
    district: string;
}

export interface ICreateShop {
    shopName: string;
    contact: string;
    tradeLicense?: string;
    category: ShopCategory;
    address: ShopAddress;
}

export interface IUpdateEmployeeRequest {
    shopId: string;
    employeeId: string;
    status: 'ACCEPTED' | 'REJECTED';
}

export interface IUpdateShop {
    shopName: string;
    contact: string;
    tradeLicense: string;
    category: ShopCategory;
}

export interface IShopConfig {
    shopId: string;
    defaultExpirationThreshold?: number;
    defaultNotSoldThreshold?: number;
    defaultLowStockThreshold?: number;
}
