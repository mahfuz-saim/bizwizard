import express from 'express';
import { productController } from './product.controller';
import validateRequest from '../../middlewares/validateRequest';
import { productZodSchema } from './product.validation';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();

router.get(
    '/id/:productId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    productController.getProductById,
);
router.get(
    '/ocr',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    productController.getProductByOCR,
);
router.get(
    '/variant/:variantCode',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    productController.getProductByVariantCode,
);

router.get(
    '/variant/id/:variantId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    productController.getProductByVariantId,
);

router.post(
    '/catalog',
    auth(UserRole.OWNER),
    verifyTenantAccess,
    validateRequest(productZodSchema.createCatalogValidation),
    productController.createProductWithVariants,
);

router.post(
    '/',
    auth(UserRole.OWNER),
    verifyTenantAccess,
    validateRequest(productZodSchema.createProductValidation),
    productController.addProductInShop,
);

router.get(
    '/lot/:lotId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    productController.getSingleLotInShop,
);
router.put(
    '/lot/:lotId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(productZodSchema.lotUpdateValidation),
    productController.updateLotInShop,
);

router.get(
    '/all-lot/:variantId',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    productController.getAllLotsInShop,
);

router.delete(
    '/lot',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(productZodSchema.lotDeletionValidation),
    productController.deleteLotInShop,
);

router.delete(
    '/:productId',
    auth(UserRole.OWNER),
    verifyTenantAccess,
    productController.deleteProductFromShop,
);
router.put(
    '/:productId',
    auth(UserRole.OWNER),
    verifyTenantAccess,
    validateRequest(productZodSchema.updateProductValidation),
    productController.updateProductInShop,
);
export const productRoutes = router;
//TODO: middlewares for authorization
