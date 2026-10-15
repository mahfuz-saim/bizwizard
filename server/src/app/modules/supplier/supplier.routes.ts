import express from 'express';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { supplierValidation } from './supplier.validation';
import { supplierController } from './supplier.controller';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();

router.post(
    '/add-to-shop',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(supplierValidation.suppllierShopAddSchema),
    supplierController.supplierAddToShop,
);

router.get(
    '/:shopId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    supplierController.getSupplierByShopId,
);

router.put(
    '/',
    auth(UserRole.OWNER, UserRole.ADMIN),
    verifyTenantAccess,
    validateRequest(supplierValidation.updateSupplierSchema),
    supplierController.updateSupplier,
);

router.delete(
    '/:id',
    auth(UserRole.OWNER, UserRole.ADMIN),
    verifyTenantAccess,
    supplierController.deleteSupplier,
);

export const supplierRoutes = router;
//TODO: access validation middlewares
//for delete /:id?shopid=shopId
