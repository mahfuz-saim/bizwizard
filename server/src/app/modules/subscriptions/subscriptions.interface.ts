export interface ICreateSubscriptionPlan {
    name: string;
    price: number;
    months: number;
    features?: { [key: string]: unknown };
    discount?: number;
}

export interface ICreateEmployeePlan {
    name: string;
    pricePerEmployee: number;
    discount?: number;
}

export interface IDeletePlan {
    id: string;
    type: 'subscription' | 'employee';
}
