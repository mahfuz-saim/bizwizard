export interface IUpdateSingleDebt {
    type: 'FULL' | 'PARTIAL';
    debtId: string;
    amount: number;
}

export interface IUpdateBulkDebt {
    amount: number;
    buyerId: string;
    shopId: string;
}

export interface IGetUserDebt {
    buyerId: string;
    shopId: string;
}

export interface IAddPreviousDebt {
    buyerId: string;
    shopId: string;
    amount: number;
    paidAmount: number;
}

export interface IGetBuyerLedger {
    buyerId: string;
    shopId: string;
}
