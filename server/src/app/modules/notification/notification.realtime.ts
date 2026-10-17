import { createHash, timingSafeEqual } from 'crypto';
import { EventEmitter } from 'events';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../../../shared/prisma';
import ApiError from '../../../errors/ApiError';
import catchAsync from '../../../shared/catchAsync';
import { JwtPayload } from '../../../interfaces/common';
import { notificationService } from './notification.service';

const changes = new EventEmitter();
changes.setMaxListeners(0);

export function verifyWebhook(
    req: Request,
    _res: Response,
    next: NextFunction,
) {
    const secret = process.env.NOTIFICATION_WEBHOOK_SECRET;
    if (!secret)
        return next(
            new ApiError(503, 'Notification webhook is not configured'),
        );
    const received = Buffer.from(req.headers.authorization || '');
    const expected = Buffer.from(`Bearer ${secret}`);
    if (
        received.length !== expected.length ||
        !timingSafeEqual(received, expected)
    ) {
        return next(new ApiError(401, 'Invalid webhook secret'));
    }
    next();
}

export const webhookSchema = z.object({
    eventId: z.string().trim().min(1).max(200),
    tenantId: z.string().min(1),
    shopId: z.string().min(1),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(5000),
});

export const receiveWebhook = catchAsync(
    async (req: Request, res: Response) => {
        const payload = webhookSchema.parse(req.body);
        const shop = await prisma.shop.findFirst({
            where: { id: payload.shopId, tenantID: payload.tenantId },
            select: { id: true },
        });
        if (!shop) throw new ApiError(404, 'Shop not found in tenant');
        // A stable primary key makes webhook retries safe, including concurrent requests.
        const id = `webhook_${createHash('sha256')
            .update(JSON.stringify([payload.tenantId, payload.eventId]))
            .digest('hex')}`;
        const notification = await prisma.notification.upsert({
            where: { id },
            update: {},
            create: {
                id,
                tenantID: payload.tenantId,
                shopId: payload.shopId,
                title: payload.title,
                body: payload.body,
                role: [],
                isPublic: false,
            },
        });
        changes.emit('changed');
        res.status(200).json({ success: true, data: notification });
    },
);

export const streamNotifications = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user as JwtPayload;
        const tenantId = req.tenantId as string;
        const shopId = req.params.shopId;
        const initial = await notificationService.getNotifications(
            shopId,
            user,
            tenantId,
        );
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        let closed = false;
        let busy = false;
        let previous = JSON.stringify(initial);
        res.write(`data: ${previous}\n\n`);
        const sync = async () => {
            if (closed || busy) return;
            busy = true;
            try {
                const data = JSON.stringify(
                    await notificationService.getNotifications(
                        shopId,
                        user,
                        tenantId,
                    ),
                );
                if (!closed) {
                    if (data !== previous) res.write(`data: ${data}\n\n`);
                    else res.write(': heartbeat\n\n');
                    previous = data;
                }
            } catch {
                // End the stream so reconnect rechecks authentication/tenant access.
                res.end();
                cleanup();
            } finally {
                busy = false;
            }
        };
        // DB reconciliation also picks up existing notification producers, read changes,
        // and webhook requests handled by other server instances.
        const timer = setInterval(() => void sync(), 2000);
        const listener = () => void sync();
        const cleanup = () => {
            closed = true;
            clearInterval(timer);
            changes.off('changed', listener);
            clearTimeout(expiry);
        };
        // JWTs must not authorize an indefinitely open stream after expiry.
        const expiryMs = Math.max(0, Number(user.exp) * 1000 - Date.now());
        const expiry = setTimeout(
            () => {
                res.end();
                cleanup();
            },
            Number.isFinite(expiryMs)
                ? Math.min(expiryMs, 2147483647)
                : 3600000,
        );
        changes.on('changed', listener);
        res.on('close', cleanup);
        // Close the small race between the initial query and listener registration.
        void sync();
    },
);
