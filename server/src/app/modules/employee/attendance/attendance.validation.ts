import { AttendanceStatus } from '@prisma/client';
import { z } from 'zod';

const clockInSchema = z.object({
    body: z.object({
        date: z.coerce.date(),
    }),
});

const clockOutSchema = clockInSchema;

const updateAttendanceSchema = z.object({
    body: z
        .object({
            attendanceId: z.string(),
            inStatus: z.nativeEnum(AttendanceStatus).optional(),
            outStatus: z.nativeEnum(AttendanceStatus).optional(),
        })
        .refine(
            data => {
                if (!data?.inStatus && !data?.outStatus) {
                    return false;
                }
                return true;
            },
            {
                message: 'Either inStatus or outStatus must be provided',
                path: ['inStatus', 'outStatus'],
            },
        ),
});

const getAttendanceSchema = z.object({
    query: z
        .object({
            shopId: z.string().optional(),
            employeeId: z.string().optional(),
            month: z.coerce.number().int().min(1).max(12),
            year: z.coerce.number().int(),
        }),
});

export const attendanceValidation = {
    clockInSchema,
    clockOutSchema,
    updateAttendanceSchema,
    getAttendanceSchema,
};
