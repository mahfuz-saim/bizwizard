export interface INote {
    shopID: string;
    name?: string;
    note: string;
    dueDate: Date;
}

export interface IUpdateNote {
    name?: string;
    note?: string;
    isComplete?: boolean;
}
