import express from 'express';
import validateRequest from '../../../middlewares/validateRequest';
import auth from '../../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { attendanceValidation } from './attendance.validation';
import { attendanceController } from './attendance.controller';
import { verifyTenantAccess } from '../../../middlewares/verifyTenant';

const router = express.Router();

router.get('/test', (req, res) => {
    res.send('Attendance API is working');
});

router.get(
    '/clock-requests/:shopId',
    auth(UserRole.OWNER, UserRole.ADMIN),
    verifyTenantAccess,
    attendanceController.getClockRequests,
);

router.post(
    '/clock-in',
    auth(UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(attendanceValidation.clockInSchema),
    attendanceController.clockInAttendance,
);

router.post(
    '/clock-out',
    auth(UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(attendanceValidation.clockOutSchema),
    attendanceController.clockOutAttendance,
);

router.get(
    '/details',
    auth(UserRole.EMPLOYEE, UserRole.ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    validateRequest(attendanceValidation.getAttendanceSchema),
    attendanceController.getAttendance,
);

router.post(
    '/update-attendance',
    auth(UserRole.OWNER, UserRole.ADMIN),
    verifyTenantAccess,
    validateRequest(attendanceValidation.updateAttendanceSchema),
    attendanceController.updateAttendance,
);

export const attendanceRoutes = router;
