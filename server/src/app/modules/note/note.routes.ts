import express from 'express';
import { noteController } from './note.controller';
import validateRequest from '../../middlewares/validateRequest';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { NoteZodSchema } from './note.validation';
import { verifyTenantAccess } from '../../middlewares/verifyTenant';

const router = express.Router();

router.post(
    '/',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(NoteZodSchema.createNoteValidation),
    noteController.createNote,
);

router.get(
    '/:id',
    auth(UserRole.ADMIN, UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    noteController.getNotesByShopId,
);

router.put(
    '/:id',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    validateRequest(NoteZodSchema.updateNoteValidation),
    noteController.updateNote,
);

router.delete(
    '/:id',
    auth(UserRole.OWNER, UserRole.EMPLOYEE),
    verifyTenantAccess,
    noteController.deleteNote,
);

export const noteRoutes = router;
