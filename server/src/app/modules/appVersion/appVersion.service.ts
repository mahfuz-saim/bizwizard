import { AppType } from '@prisma/client';
import prisma from '../../../shared/prisma';
import { IAppVersion } from './appVersion.interface';

const getAppVersion = async (appType: AppType) => {
    const result = await prisma.appVersion.findFirst({
        where: {
            appType: appType,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return result;
};

const createAppVersion = async (payload: IAppVersion) => {
    const result = await prisma.appVersion.create({
        data: payload,
    });
    return result;
};

export const appVersionService = { getAppVersion, createAppVersion };
