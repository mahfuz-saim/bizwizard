import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { Prisma } from '@prisma/client';
import { AuthUtils } from '../../../helpers/bcryptHelpers';
import { JWTHelper } from '../../../helpers/jwtHelpers';
import type { IUploadFile } from '../../../interfaces/file';
import prisma from '../../../shared/prisma';
import { UserServices } from './user.service';

function stub<F extends (...args: never[]) => unknown>(t: TestContext, target: object, name: string, implementation: F) {
    const original = Reflect.get(target, name);
    const replacement = t.mock.fn(implementation);
    Reflect.set(target, name, replacement);
    t.after(() => { Reflect.set(target, name, original); });
    return replacement;
}

const profile = {
    name: 'Test user', number: '01000000000', address: 'Test address',
    dob: '1990-01-01', tenantID: 'test-tenant', company: 'Test supplier',
};
const noFile = undefined as unknown as IUploadFile;
const cases: Array<[string, () => Promise<unknown>]> = [
    ['admin', () => UserServices.createAdmin({ password: 'test-password', admin: profile }, noFile)],
    ['sales representative', () => UserServices.createSale({ password: 'test-password', sale: profile }, noFile)],
    ['buyer', () => UserServices.createBuyer({ password: 'test-password', buyer: profile })],
    ['employee', () => UserServices.createEmployee({ password: 'test-password', employee: profile })],
    ['owner', () => UserServices.createUser({ password: 'test-password', userType: 'owner', user: profile })],
    ['supplier', () => UserServices.createSupplier({ password: 'test-password', supplier: profile })],
];

for (const [role, create] of cases) {
    test(`${role} creation stores the password hash and salt separately`, async t => {
        let saved: Prisma.UserUpsertArgs | undefined;
        const tx = {
            user: {
                upsert: async (args: Prisma.UserUpsertArgs) => {
                    saved = args;
                    return { id: 'test-user', number: profile.number, role: args.create.role };
                },
            },
            admin: { create: async () => ({ userID: 'test-user' }) },
            salesRepresentative: { create: async () => ({ userID: 'test-user' }) },
            buyer: { create: async () => ({ userID: 'test-user', number: profile.number }) },
            employee: { create: async () => ({ userID: 'test-user', number: profile.number }) },
            owner: { create: async () => ({ userID: 'test-user' }) },
            supplier: { create: async () => ({ userID: 'test-user' }) },
        };
        stub(t, prisma, '$transaction', async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) => callback(tx as unknown as Prisma.TransactionClient));
        t.mock.method(JWTHelper, 'createToken', () => 'test-token');
        await create();
        assert.ok(saved);
        assert.equal(typeof saved.create.password, 'string');
        assert.equal(typeof saved.create.passwordSalt, 'string');
        assert.equal(saved.update.password, saved.create.password);
        assert.equal(saved.update.passwordSalt, saved.create.passwordSalt);
        assert.equal(await AuthUtils.comparePasswords('test-password', saved.create.password!, saved.create.passwordSalt), true);
        assert.equal(await AuthUtils.comparePasswords('wrong-password', saved.create.password!, saved.create.passwordSalt), false);
    });
}
