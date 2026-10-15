import { AttendanceStatus, Prisma, UserRole } from '@prisma/client';
import prisma from '../../../../shared/prisma';
import ApiError from '../../../../errors/ApiError';
import httpStatus from 'http-status';
import { sendNotificationToTokens } from '../../../../helpers/sendPushNotification';
import { JwtPayload } from '../../../../interfaces/common';
import { IFilters, IUpdateAttendance } from './attendance.interface';

async function clockInAttendance(
    user: JwtPayload,
    date: Date,
    tenantId: string,
) {
    const userId = user.userID;
    // change check in flag to PENDING and wait for owner approval
    const employee = await prisma.employee.findFirstOrThrow({
        where: {
            userID: userId,
            tenantID: tenantId,
        },
    });

    if (!employee.shopID) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            'Employee does not belong to any shop',
        );
    }

    const day = new Date(date);
    day.setUTCHours(0, 0, 0, 0);
    const existingData = await prisma.attendance.findFirst({
        where: {
            employeeId: userId,
            date: day,
            tenantID: tenantId,
        },
    });

    const notifyOwner =
        !existingData ||
        (existingData && existingData.inStatus === AttendanceStatus.ABSENT);

    const existingInStatus = existingData?.inStatus;
    if (
        (existingInStatus && existingInStatus === AttendanceStatus.LATE) ||
        existingInStatus === AttendanceStatus.PRESENT
    ) {
        //NOTE: If the employee has already clocked in and is present or late, we do not allow clocking in again.
        return existingData;
    }

    const attendanceData = await prisma.attendance.upsert({
        where: {
            employeeId_date: {
                employeeId: userId,
                date: day,
            },
        },
        create: {
            employeeId: userId,
            tenantID: tenantId,
            date: day,
            inTime: new Date(),
            inStatus: AttendanceStatus.REQUESTED,
            outStatus: AttendanceStatus.PENDING,
        },
        update: {
            inStatus: AttendanceStatus.REQUESTED,
            outStatus: existingData?.outStatus || AttendanceStatus.PENDING,
        },
    });

    if (notifyOwner) {
        const owner = await prisma.shop.findFirst({
            where: {
                id: employee.shopID,
                tenantID: tenantId,
            },
        });

        const ownerFCMTOken = await prisma.fCM_Token.findUnique({
            where: {
                userId: owner?.ownerID || '',
            },
        });

        if (ownerFCMTOken) {
            const notificationData = {
                title: 'Attendance Request',
                body: `Employee ${employee.name} has requested attendance for ${day.toDateString()}. Please review.`,
            };

            await prisma.notification.create({
                data: {
                    title: notificationData.title,
                    body: notificationData.body,
                    shopId: employee.shopID,
                    tenantID: tenantId,
                    role: [UserRole.OWNER],
                },
            });
            sendNotificationToTokens([ownerFCMTOken.token], {
                notification: notificationData,
            });
        }
    }

    return attendanceData;
}

async function clockOutAttendance(
    user: JwtPayload,
    date: Date,
    tenantId: string,
) {
    const userId = user.userID;

    const employee = await prisma.employee.findFirstOrThrow({
        where: {
            userID: userId,
            tenantID: tenantId,
        },
    });

    if (!employee.shopID) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            'Employee does not belong to any shop',
        );
    }

    const day = new Date(date);
    day.setUTCHours(0, 0, 0, 0);
    const existingData = await prisma.attendance.findFirst({
        where: {
            employeeId: userId,
            date: day,
            tenantID: tenantId,
        },
    });

    if (!existingData || existingData?.inStatus === AttendanceStatus.ABSENT) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            'You have not clocked in yet.',
        );
    }

    //TODO:
    const notifyOwner =
        existingData && existingData.outStatus === AttendanceStatus.ABSENT;

    const existingOutStatus = existingData?.outStatus;
    if (
        (existingOutStatus && existingOutStatus === AttendanceStatus.LATE) ||
        existingOutStatus === AttendanceStatus.PRESENT
    ) {
        //NOTE: If the employee has already clocked in and is present or late, we do not allow clocking in again.
        return existingData;
    }
    const attendanceData = await prisma.attendance.update({
        where: {
            employeeId_date: {
                employeeId: userId,
                date: day,
            },
        },
        data: {
            outStatus: AttendanceStatus.REQUESTED,
            outTime: new Date(),
        },
    });

    if (notifyOwner) {
        const owner = await prisma.shop.findFirst({
            where: {
                id: employee.shopID,
                tenantID: tenantId,
            },
        });

        const ownerFCMTOken = await prisma.fCM_Token.findUnique({
            where: {
                userId: owner?.ownerID || '',
            },
        });

        if (ownerFCMTOken) {
            const notificationData = {
                title: 'Attendance Request',
                body: `Employee ${employee.name} has requested attendance for ${day.toDateString()}. Please review.`,
            };
            await prisma.notification.create({
                data: {
                    title: notificationData.title,
                    body: notificationData.body,
                    shopId: employee.shopID,
                    tenantID: tenantId,
                    role: [UserRole.OWNER],
                },
            });
            sendNotificationToTokens([ownerFCMTOken.token], {
                notification: notificationData,
            });
        }
    }

    return attendanceData;
}

async function getAttendance(
    user: JwtPayload,
    filters: IFilters,
    tenantId: string,
) {
    const { shopId, employeeId, month, year } = filters;
    if (!month || !year) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            'Month and Year are required',
        );
    }

    const attendanceWhereInput: Prisma.AttendanceWhereInput = {
        tenantID: tenantId,
    };

    const monthNumber = Number(month);
    const yearNumber = Number(year);
    attendanceWhereInput.month = monthNumber;
    attendanceWhereInput.year = yearNumber;

    if (user.role === UserRole.EMPLOYEE) {
        attendanceWhereInput.employeeId = user.userID;
    } else if (user.role === UserRole.ADMIN || user.role === UserRole.OWNER) {
        if (employeeId) {
            attendanceWhereInput.employeeId = employeeId;
        }
        if (shopId) {
            const empWhereInput: Prisma.EmployeeWhereInput = {
                shopID: shopId,
                isDeleted: false,
                tenantID: tenantId,
            };
            if (user.role === UserRole.OWNER) {
                empWhereInput.shop = {
                    ownerID: user.userID,
                };
            }
            const employees = await prisma.employee.findMany({
                where: empWhereInput,
                select: {
                    userID: true,
                },
            });
            attendanceWhereInput.employeeId = {
                in: employees.map(emp => emp.userID),
            };
        }
    }

    const result = await prisma.attendance.findMany({
        where: attendanceWhereInput,
        orderBy: {
            date: 'asc',
        },
    });
    return result;
}

async function updateAttendance(
    payload: IUpdateAttendance,
    user: JwtPayload,
    tenantId: string,
) {
    const attendance = await prisma.attendance.findFirstOrThrow({
        where: {
            id: payload.attendanceId,
            tenantID: tenantId,
        },
        include: {
            Employee: {
                include: {
                    shop: true,
                },
            },
        },
    });

    if (
        user.role === UserRole.OWNER &&
        attendance.Employee.shop?.ownerID !== user.userID
    ) {
        throw new ApiError(
            httpStatus.FORBIDDEN,
            'You are not allowed to update this attendance',
        );
    }

    const result = await prisma.attendance.update({
        where: {
            id: payload.attendanceId,
        },
        data: {
            inStatus: payload.inStatus || attendance.inStatus,
            outStatus: payload.outStatus || attendance.outStatus,
        },
    });

    return result;
}

const getClockRequests = async (shopId: string, tenantId: string) => {
    const shop = await prisma.shop.findFirst({
        where: {
            id: shopId,
            tenantID: tenantId,
        },
    });

    if (!shop) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
    }

    const attendanceRequests = await prisma.attendance.findMany({
        where: {
            tenantID: tenantId,
            Employee: {
                shopID: shopId,
                tenantID: tenantId,
            },
            OR: [
                { inStatus: AttendanceStatus.REQUESTED },
                { outStatus: AttendanceStatus.REQUESTED },
                { outStatus: AttendanceStatus.PENDING },
            ],
        },
        include: {
            Employee: true,
        },
    });
    return attendanceRequests;
};

export const attendanceService = {
    clockInAttendance,
    clockOutAttendance,
    getAttendance,
    updateAttendance,
    getClockRequests,
};
