export interface ISupplierAddToShop {
    shopId: string;
    name: string;
    number: string;
    comment?: string;
    company?: string;
}

export interface IUpdateSupplier {
    supplierId: string;
    shopId: string;
    supplierName: string;
    comment: string;
    company?: string;
}
