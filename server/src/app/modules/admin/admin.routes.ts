import express, { NextFunction, Request, Response } from 'express';
import { adminController } from './admin.controller';
import { FileUploadHelper } from '../../../helpers/fileUploadHelper';
import validateRequest from '../../middlewares/validateRequest';
import { adminValidation } from './admin.validation';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.get('/', auth(UserRole.SUPER_ADMIN), adminController.getAllAdmin);
router.get('/:id', auth(UserRole.SUPER_ADMIN), adminController.getAdminByID);
router.delete('/:id', auth(UserRole.SUPER_ADMIN), adminController.deleteAdmin);
router.put(
    '/:id',
    auth(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    FileUploadHelper.upload.single('file'),
    (req: Request, res: Response, next: NextFunction) => {
        req.body = JSON.parse(req.body.data);
        next();
    },
    validateRequest(adminValidation.updateAdmin),
    adminController.updateAdmin,
);

export const adminRouters = router;
