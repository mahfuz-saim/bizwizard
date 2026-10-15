import { AttendanceStatus } from '@prisma/client';

export interface IFilters {
    shopId?: string;
    employeeId?: string;
    month?: number;
    year?: number;
}

export interface IUpdateAttendance {
    attendanceId: string;
    inStatus: AttendanceStatus;
    outStatus: AttendanceStatus;
}
