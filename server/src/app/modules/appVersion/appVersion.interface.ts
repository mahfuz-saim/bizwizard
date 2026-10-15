import { AppType } from '@prisma/client';

export interface IAppVersion {
    version: string;
    description?: string;
    appType: AppType;
    isMandatory?: boolean;
}
