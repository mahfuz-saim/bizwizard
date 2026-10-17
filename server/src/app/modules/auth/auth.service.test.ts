import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { UserRole, UserStatus, type User, type Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { AuthUtils } from '../../../helpers/bcryptHelpers';
import { JWTHelper } from '../../../helpers/jwtHelpers';
import type { JwtPayload } from '../../../interfaces/common';
import prisma from '../../../shared/prisma';
import { AuthService } from './auth.service';

function stub<F extends (...args: never[]) => unknown>(t: TestContext, target: object, name: string, implementation: F) {
    const original = Reflect.get(target, name);
    const replacement = t.mock.fn(implementation);
    Reflect.set(target, name, replacement);
    t.after(() => { Reflect.set(target, name, original); });
    return replacement;
}

function user(role: UserRole, password: string | null, passwordSalt: string | null): User {
    return {
        id: 'test-user', number: '01000000000', email: 'test@example.invalid',
        name: 'Test user', role: [role], status: UserStatus.ACTIVE,
        password, passwordSalt, OTP: 0, createdAt: new Date(), updatedAt: new Date(),
    };
}

for (const [label, role, login] of [
    ['owner', UserRole.OWNER, AuthService.loginUser],
    ['admin', UserRole.ADMIN, AuthService.adminUserLogin],
] as const) {
    test(`${label} password login rejects accounts without a password`, async t => {
        stub(t, prisma.user, 'findFirst', async () => user(role, null, null));
        const tokens = t.mock.method(JWTHelper, 'createToken', () => 'test-token');
        await assert.rejects(login({ number: '01000000000', password: 'arbitrary' }), { statusCode: 401 });
        assert.equal(tokens.mock.callCount(), 0);
    });

    test(`${label} password login accepts the stored hash and salt and rejects a wrong password`, async t => {
        const { hash, salt } = await AuthUtils.hashedPassword('correct-password');
        stub(t, prisma.user, 'findFirst', async () => user(role, hash, salt));
        stub(t, prisma.refreshToken, 'upsert', async () => ({}));
        const tokens = t.mock.method(JWTHelper, 'createToken', () => 'test-token');
        await assert.rejects(login({ number: '01000000000', password: 'wrong-password' }), { statusCode: 401 });
        assert.equal(tokens.mock.callCount(), 0);
        const result = await login({ number: '01000000000', password: 'correct-password' });
        assert.equal(result.accessToken, 'test-token');
        assert.equal(tokens.mock.callCount(), 2);
    });
}

test('legacy password hashes without a separate salt still work', async t => {
    const hash = await bcrypt.hash('legacy-password', 10);
    stub(t, prisma.user, 'findFirst', async () => user(UserRole.OWNER, hash, null));
    stub(t, prisma.refreshToken, 'upsert', async () => ({}));
    t.mock.method(JWTHelper, 'createToken', () => 'test-token');
    assert.equal((await AuthService.loginUser({ number: '01000000000', password: 'legacy-password' })).accessToken, 'test-token');
});

test('changing a password verifies the old password with its stored salt', async t => {
    const { hash, salt } = await AuthUtils.hashedPassword('old-password');
    stub(t, prisma.user, 'findUnique', async () => user(UserRole.OWNER, hash, salt));
    const update = stub(t, prisma.user, 'update', async (_args: Prisma.UserUpdateArgs) => ({}));
    const actor: JwtPayload = { userID: 'test-user', role: UserRole.OWNER, iat: 0, exp: 1 };
    await assert.rejects(AuthService.changePassword(actor, { oldPassword: 'wrong', newPassword: 'new-password' }), { statusCode: 401 });
    assert.equal(update.mock.callCount(), 0);
    await AuthService.changePassword(actor, { oldPassword: 'old-password', newPassword: 'new-password' });
    const data = update.mock.calls[0].arguments[0].data;
    assert.equal(await AuthUtils.comparePasswords('new-password', data.password as string, data.passwordSalt as string), true);
});

test('changing a password cannot bypass verification for a passwordless account', async t => {
    stub(t, prisma.user, 'findUnique', async () => user(UserRole.OWNER, null, null));
    const update = stub(t, prisma.user, 'update', async () => ({}));
    await assert.rejects(AuthService.changePassword(
        { userID: 'test-user', role: UserRole.OWNER, iat: 0, exp: 1 },
        { oldPassword: 'anything', newPassword: 'new-password' },
    ), { statusCode: 401 });
    assert.equal(update.mock.callCount(), 0);
});
