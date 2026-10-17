import assert from 'node:assert/strict';
import { test } from 'node:test';
import express, { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../src/shared/prisma';
import config from '../src/config';
import { notificationRoutes } from '../src/app/modules/notification/notification.routes';
import { notificationVisibility } from '../src/app/modules/notification/notification.service';

// Exercise the actual router/auth/validation/SSE with an in-memory persistence adapter.
// No database or Firebase credentials are required for webhook notifications.
test('webhook -> persistent list -> live stream -> read status, with access controls and retries', async () => {
    process.env.NOTIFICATION_WEBHOOK_SECRET = 'test-only-webhook-secret';
    config.jwt.secret = 'test-only-jwt-secret';
    const user = {
        userID: 'owner',
        role: 'OWNER' as const,
        iat: 1,
        exp: 9999999999,
    };
    const token = jwt.sign(
        { userID: user.userID, role: user.role },
        config.jwt.secret,
        { expiresIn: '1h' },
    );
    const restores: (() => void)[] = [];
    const stub = (object: any, key: string, implementation: any) => {
        const original = object[key];
        object[key] = implementation;
        restores.push(() => {
            object[key] = original;
        });
    };
    const rows = new Map<string, any>();
    const reads: any[] = [];
    const matches = (row: any, where: any): boolean =>
        Object.entries(where).every(([key, value]: [string, any]) => {
            if (key === 'AND') return value.every((w: any) => matches(row, w));
            if (key === 'OR') return value.some((w: any) => matches(row, w));
            if (value && typeof value === 'object' && 'has' in value)
                return row[key]?.includes(value.has);
            return (row[key] ?? null) === value;
        });
    stub(prisma.tenant, 'findFirst', async ({ where }: any) =>
        where.id === 'tenant' ? { id: 'tenant' } : null,
    );
    stub(prisma.shop, 'findFirst', async ({ where }: any) =>
        where.id === 'shop' && where.tenantID === 'tenant'
            ? { id: 'shop' }
            : null,
    );
    stub(prisma.employee, 'findFirst', async ({ where }: any) =>
        matches(
            {
                userID: 'employee',
                tenantID: 'tenant',
                shopID: 'other-shop',
                isDeleted: false,
            },
            where,
        )
            ? { shopID: 'other-shop' }
            : null,
    );
    stub(prisma.notification, 'upsert', async ({ where, create }: any) => {
        if (!rows.has(where.id))
            rows.set(where.id, {
                ...create,
                userId: null,
                createdAt: new Date().toISOString(),
            });
        return rows.get(where.id);
    });
    stub(prisma.notification, 'findMany', async ({ where }: any) =>
        [...rows.values()]
            .filter(row => matches(row, where))
            .map(row => ({
                ...row,
                ReadStatus: reads.filter(
                    read => read.notificationId === row.id,
                ),
            })),
    );
    stub(
        prisma.notification,
        'findFirst',
        async ({ where }: any) =>
            [...rows.values()].find(row => matches(row, where)) || null,
    );
    stub(prisma.notification, 'update', async () => ({}));
    stub(
        prisma.notificationRead,
        'findFirst',
        async ({ where }: any) =>
            reads.find(read => matches(read, where)) || null,
    );
    stub(prisma.notificationRead, 'create', async ({ data }: any) => {
        const read = { id: `read-${reads.length}`, ...data };
        reads.push(read);
        return read;
    });
    stub(prisma.notificationRead, 'update', async ({ where, data }: any) =>
        Object.assign(
            reads.find(read => read.id === where.id),
            data,
        ),
    );
    stub(prisma, '$transaction', async (fn: any) => fn(prisma));
    const app = express();
    app.use(express.json());
    app.use('/notifications', notificationRoutes);
    app.use((error: any, _req: Request, res: Response, _next: NextFunction) =>
        res.status(error.statusCode || 400).json({ message: error.message }),
    );
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address() as { port: number };
    const base = `http://127.0.0.1:${address.port}/notifications`;
    const headers = {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': 'tenant',
        'Content-Type': 'application/json',
    };
    const webhookHeaders = {
        Authorization: 'Bearer test-only-webhook-secret',
        'Content-Type': 'application/json',
    };
    const payload = {
        eventId: 'event-1',
        tenantId: 'tenant',
        shopId: 'shop',
        title: 'Low stock',
        body: 'Restock now',
    };
    const controller = new AbortController();
    try {
        assert.equal((await fetch(`${base}/shop`)).status, 401);
        const employeeToken = jwt.sign(
            { userID: 'employee', role: 'EMPLOYEE' },
            config.jwt.secret!,
            { expiresIn: '1h' },
        );
        assert.equal(
            (
                await fetch(`${base}/shop`, {
                    headers: {
                        ...headers,
                        Authorization: `Bearer ${employeeToken}`,
                    },
                })
            ).status,
            403,
        );
        delete process.env.NOTIFICATION_WEBHOOK_SECRET;
        assert.equal(
            (
                await fetch(`${base}/webhook`, {
                    method: 'POST',
                    headers: webhookHeaders,
                    body: JSON.stringify(payload),
                })
            ).status,
            503,
        );
        process.env.NOTIFICATION_WEBHOOK_SECRET = 'test-only-webhook-secret';
        assert.equal(
            (
                await fetch(`${base}/shop`, {
                    headers: { ...headers, 'x-tenant-id': 'other-tenant' },
                })
            ).status,
            403,
        );
        assert.equal(
            (
                await fetch(`${base}/webhook`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                })
            ).status,
            401,
        );
        assert.equal(
            (
                await fetch(`${base}/webhook`, {
                    method: 'POST',
                    headers: webhookHeaders,
                    body: '{}',
                })
            ).status,
            400,
        );
        assert.equal(
            (
                await fetch(`${base}/webhook`, {
                    method: 'POST',
                    headers: webhookHeaders,
                    body: JSON.stringify({
                        ...payload,
                        tenantId: 'other-tenant',
                    }),
                })
            ).status,
            404,
        );
        const stream = await fetch(`${base}/stream/shop`, {
            headers,
            signal: controller.signal,
        });
        assert.equal(stream.status, 200);
        assert.match(
            stream.headers.get('content-type') || '',
            /text\/event-stream/,
        );
        const reader = stream.body!.getReader();
        assert.match(
            new TextDecoder().decode((await reader.read()).value),
            /data: \[\]/,
        );
        const response = await fetch(`${base}/webhook`, {
            method: 'POST',
            headers: webhookHeaders,
            body: JSON.stringify(payload),
        });
        assert.equal(response.status, 200);
        const notification = (await response.json()).data;
        assert.ok(notification.id);
        let live = '';
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
            while (!live.includes('Low stock'))
                live += new TextDecoder().decode((await reader.read()).value);
        } finally {
            clearTimeout(timeout);
        }
        assert.match(live, /Low stock/);
        await fetch(`${base}/webhook`, {
            method: 'POST',
            headers: webhookHeaders,
            body: JSON.stringify(payload),
        });
        assert.equal(rows.size, 1, 'retry must not create a duplicate');
        const list = await (await fetch(`${base}/shop`, { headers })).json();
        assert.equal(list.data.length, 1);
        assert.deepEqual(list.data[0].ReadStatus, []);
        const mark = () =>
            fetch(`${base}/mark-read/${notification.id}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ shopId: 'shop' }),
            });
        assert.equal((await mark()).status, 201);
        assert.equal((await mark()).status, 201);
        assert.equal(reads.length, 1, 'mark read is idempotent');
        assert.equal(
            (await (await fetch(`${base}/shop`, { headers })).json()).data[0]
                .ReadStatus[0].isRead,
            true,
        );
        const visibility = notificationVisibility('shop', user, 'tenant');
        assert.equal(
            matches({ ...notification, userId: 'someone-else' }, visibility),
            false,
        );
        assert.equal(
            matches({ ...notification, shopId: 'another-shop' }, visibility),
            false,
        );
        assert.equal(
            matches({ ...notification, tenantID: 'other-tenant' }, visibility),
            false,
        );
    } finally {
        controller.abort();
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
        restores.reverse().forEach(restore => restore());
    }
});
