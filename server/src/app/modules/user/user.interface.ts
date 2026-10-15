export interface IAdmin {
    password: string;
    admin: {
        name: string;
        number: string;
        image?: string;
    };
}
export interface ISale {
    password: string;
    sale: {
        name: string;
        number: string;
        image?: string;
    };
    // optional — if provided, the new SR is being referred by another SR
    referralCode?: string;
}

export interface IBuyer {
    password: string;
    buyer: {
        name: string;
        number: string;
        address: string;
    };
}

export interface IEmployee {
    password: string;
    employee: {
        name: string;
        number: string;
        address: string;
        dob: string;
        tenantID: string;
        shopID?: string;
        nid?: string;
        birthCertificate?: string;
    };
}

export interface IUser {
    user: {
        name: string;
        number: string;
        image?: string;
        address: string;
        dob: string;
        nid?: string;
        birthCertificate?: string;
        email?: string;
    };
    referralCode?: string;
    userType: 'owner' | 'employee';
    password?: string;
}

export interface ISupplier {
    password: string;
    supplier: {
        name: string;
        number: string;
        company: string;
        image?: string;
    };
}
