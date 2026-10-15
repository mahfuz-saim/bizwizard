import express from 'express';
import { employeeController } from './employee.controller';
import validateRequest from '../../middlewares/validateRequest';
import { employeeZodSchema } from './employee.validation';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { attendanceRoutes } from './attendance/attendance.routes';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();

router.use('/attendance', attendanceRoutes);

router.get('/myshop', auth(UserRole.EMPLOYEE), employeeController.getMyShop);

router.get(
    '/join-requests',
    auth(UserRole.EMPLOYEE),
    employeeController.getJoinRequests,
);

router.get(
    '/',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    employeeController.getEmployee,
);
router.get(
    '/:id',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    employeeController.getEmployeeByID,
);
router.delete(
    '/:id',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    verifyTenantAccess,
    employeeController.deleteEmployee,
);
router.put(
    '/:id',
    auth(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.SUPER_ADMIN),
    verifyTenantAccess,
    validateRequest(employeeZodSchema.updateEmployee),
    employeeController.updateEmployee,
);

router.get(
    '/join-shop/:shopCode',
    auth(UserRole.EMPLOYEE),
    employeeController.joinShop,
);

router.delete(
    '/join-request/:shopCode',
    auth(UserRole.EMPLOYEE),
    verifyTenantAccess,
    employeeController.deleteJoinRequest,
);

export const employeeRoutes = router;
