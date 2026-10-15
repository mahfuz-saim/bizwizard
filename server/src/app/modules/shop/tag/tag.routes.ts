import express from 'express';
import validateRequest from '../../../middlewares/validateRequest';
import auth from '../../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { tagController } from './tag.controller';
import { tagZodSchema } from './tag.validation';
import { verifyTenantAccess } from '../../../middlewares/verifyTenant';

const router = express.Router();

router.get('/test', tagController.test);

router.post(
    '/assign-buyer',

    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(tagZodSchema.tagAssignBuyerSchema),
    tagController.assignTagToCustomer,
);

router.post(
    '/remove-buyer',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(tagZodSchema.tagAssignBuyerSchema),
    tagController.removeTagFromCustomer,
);

router.post(
    '/',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(tagZodSchema.tagCreateSchema),
    tagController.createTag,
);

router.put(
    '/',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(tagZodSchema.tagUpdateSchema),
    tagController.updateTag,
);

router.delete(
    '/:tagId',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    tagController.deleteTag,
);

router.get(
    '/:shopId',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    tagController.getTagsByShopId,
);

export const tagRoutes = router;

/*
 * TODO:
 * - shop access validation
 */
