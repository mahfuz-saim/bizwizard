import { z } from 'zod';

const createNoteValidation = z.object({
    body: z.object({
        shopID: z.string(),
        name: z.string().optional(),
        note: z.string(),
        dueDate: z.preprocess(val => {
            if (typeof val === 'string') return new Date(val);
            return val;
        }, z.date()),
    }),
});

const updateNoteValidation = z.object({
    body: z.object({
        name: z.string().optional(),
        note: z.string().optional(),
        isComplete: z.boolean().optional(),
    }),
});

export const NoteZodSchema = {
    createNoteValidation,
    updateNoteValidation,
};
