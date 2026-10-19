import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { JWTHelper } from '../../../helpers/jwtHelpers';
import auth from '../../middlewares/auth';
import ApiError from '../../../errors/ApiError';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

for (const error of [new TokenExpiredError('jwt expired', new Date()), new JsonWebTokenError('invalid signature')]) {
    test(`${error.name} becomes an authentication error, not a server error`, async t => {
        t.mock.method(JWTHelper, 'verifyToken', () => { throw error; });
        let caught: unknown;
        await auth('OWNER')({ headers: { authorization: 'Bearer expired' } } as Request, {} as Response, ((err: unknown) => { caught = err; }) as NextFunction);
        assert(caught instanceof ApiError);
        assert.equal(caught.statusCode, 401);
        assert.match(caught.message, /sign in again/);
    });
}

test('a valid token with the wrong role remains forbidden', async t => {
    t.mock.method(JWTHelper, 'verifyToken', () => ({ userID: 'employee', role: 'EMPLOYEE' }));
    let caught: unknown;
    await auth('OWNER')({ headers: { authorization: 'Bearer valid' } } as Request, {} as Response, ((err: unknown) => { caught = err; }) as NextFunction);
    assert(caught instanceof ApiError);
    assert.equal(caught.statusCode, 403);
});

test('refresh updates the HttpOnly access cookie without replacing the refresh cookie', async t => {
    t.mock.method(AuthService, 'refreshToken', async (token: string) => {
        assert.equal(token, 'refresh-cookie');
        return { accessToken: 'new-access' };
    });
    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    let body: { data?: { accessToken?: string } } = {};
    const res = {
        cookie(name: string, value: string, options: Record<string, unknown>) { cookies.push({ name, value, options }); return this; },
        status() { return this; },
        json(value: typeof body) { body = value; return this; },
    };
    await AuthController.refreshToken({ cookies: { refreshToken: 'refresh-cookie' } } as unknown as Request, res as unknown as Response, ((error: unknown) => { throw error; }) as NextFunction);
    assert.equal(cookies.length, 1);
    assert.equal(cookies[0].name, 'accessToken');
    assert.equal(cookies[0].value, 'new-access');
    assert.equal(cookies[0].options.httpOnly, true);
    assert.equal(cookies[0].options.sameSite, 'lax');
    assert.equal(body.data?.accessToken, 'new-access');
});
