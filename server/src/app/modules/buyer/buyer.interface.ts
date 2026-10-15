export interface IBuyer {
    number: string;
    name: string;
    shopID: string;
}

export interface IAddBuyer {
    number: string;
    name: string;
    address: string;
    shopID: string;
}

export interface IUpdateShopBuyer {
    name: string;
    address: string;
    shopID: string;
    buyerID: string;
}

export interface ICustomerFilterRequest {
    searchTerm?: string | undefined;
    name?: string | undefined;
    systemTag?: string[];
    customTag?: string[];
}
