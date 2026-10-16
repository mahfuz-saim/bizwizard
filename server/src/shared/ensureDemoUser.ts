import { UserRole, UserStatus } from '@prisma/client';
import config from '../config';
import { AuthUtils } from '../helpers/bcryptHelpers';
import prisma from './prisma';

/**
 * If DEMO_EMAIL + DEMO_PASSWORD are set in .env, ensure a matching OWNER
 * account + tenant + shop exist. This lets the web frontend (which has no
 * login screen) auto-authenticate in development. The password is hashed
 * with a unique per-user salt just like any other user.
 */
export async function ensureDemoUser() {
    const { email, password, number, shopName } = config.demo;
    if (!email || !password) return;

    const normalizedEmail = email.toLowerCase();

    try {
        const existing = await prisma.user.findFirst({
            where: { OR: [{ email: normalizedEmail }, { number }] },
            include: { Owner: true },
        });

        if (existing) {
            // If the existing user already has a password+salt, leave them alone.
            if (existing.password && existing.passwordSalt) return;
            // Otherwise set/upgrade the password to the demo password with a salt.
            const { hash, salt } = await AuthUtils.hashedPassword(password);
            await prisma.user.update({
                where: { id: existing.id },
                data: { password: hash, passwordSalt: salt, status: UserStatus.ACTIVE },
            });
            return;
        }

        const { hash, salt } = await AuthUtils.hashedPassword(password);
        const displayName = 'Demo Owner';

        await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    number,
                    email: normalizedEmail,
                    password: hash,
                    passwordSalt: salt,
                    role: [UserRole.OWNER],
                    status: UserStatus.ACTIVE,
                    OTP: 0,
                    name: displayName,
                },
            });

            await tx.owner.create({
                data: {
                    userID: user.id,
                    name: displayName,
                    number,
                    email: normalizedEmail,
                    dob: '',
                    address: '',
                },
            });

            const tenant = await tx.tenant.create({
                data: {
                    name: shopName,
                    code: `DEMO-${user.id.slice(0, 6).toUpperCase()}`,
                    ownerID: user.id,
                },
            });

            await tx.shop.create({
                data: {
                    shopName,
                    contact: number,
                    tenantID: tenant.id,
                    ownerID: user.id,
                    category: 'OTHER' as any,
                },
            });
        });

        console.log(`[demo] Seeded demo owner ${normalizedEmail}`);
    } catch (err) {
        console.warn('[demo] Failed to ensure demo user:', (err as Error).message);
    }
}
