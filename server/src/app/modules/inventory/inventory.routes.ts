import express, { NextFunction, Request, Response } from 'express';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { FileUploadHelper } from '../../../helpers/fileUploadHelper';
import validateRequest from '../../middlewares/validateRequest';
import { inventoryZodSchema } from './inventory.validation';
import { inventoryController } from './inventory.controller';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();

router.post(
    '/',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    FileUploadHelper.upload.single('file'),
    (req: Request, res: Response, next: NextFunction) => {
        req.body = JSON.parse(req.body.data);
        next();
    },
    validateRequest(inventoryZodSchema.createProductZodSchema),
    inventoryController.createProductInInventory,
);

router.get(
    '/',
    auth(
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.OWNER,
        UserRole.EMPLOYEE,
    ),
    verifyTenantAccess,
    inventoryController.getProductFromInventory,
);

router.get(
    '/generic-name',
    // auth(
    //     UserRole.ADMIN,
    //     UserRole.SUPER_ADMIN,
    //     UserRole.OWNER,
    //     UserRole.EMPLOYEE,
    // ),
    inventoryController.getProductGenericNames,
);
router.get(
    '/:id',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER),
    verifyTenantAccess,
    inventoryController.getSingleProduct,
);
router.delete(
    '/:id',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    inventoryController.deleteProductInInventory,
);

router.put(
    '/:id',
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    FileUploadHelper.upload.single('file'),
    (req: Request, res: Response, next: NextFunction) => {
        req.body = JSON.parse(req.body.data);
        next();
    },
    validateRequest(inventoryZodSchema.updateProductZodSchema),
    inventoryController.updateProductInInventory,
);

export const inventoryRoutes = router;
