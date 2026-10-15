export interface ITagCreate {
    name: string;
    shopId: string;
    description?: string;
}

export interface ITagUpdate {
    tagId: string;
    name: string;
    description?: string;
}

export interface ITagAssign {
    tagId: string;
    customerId: string[];
}
