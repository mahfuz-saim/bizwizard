import * as bcrypt from 'bcrypt';
import crypto from 'crypto';

const DEFAULT_SALT_ROUNDS = 10;

/**
 * Generate a cryptographically random per-user salt. Stored alongside the
 * bcrypt hash on the User record so every user has a unique salt.
 */
const generateSalt = (): string => {
    return crypto.randomBytes(16).toString('hex');
};

/**
 * Hash a password with an explicit per-user salt. The salt is prepended to
 * the plaintext password before feeding it to bcrypt, so even if two users
 * choose the same password, their stored hashes are different. Bcrypt still
 * adds its own internal salt, providing defense in depth.
 */
const hashedPassword = async (
    password: string,
    existingSalt?: string,
): Promise<{ hash: string; salt: string }> => {
    const salt = existingSalt || generateSalt();
    const salted = salt + password;
    const hash = await bcrypt.hash(salted, DEFAULT_SALT_ROUNDS);
    return { hash, salt };
};

/**
 * Verify a plaintext password against a stored hash + per-user salt.
 */
async function comparePasswords(
    plainTextPassword: string,
    hashedPassword: string,
    salt?: string | null,
): Promise<boolean> {
    const salted = (salt || '') + plainTextPassword;
    return bcrypt.compare(salted, hashedPassword);
}

/**
 * Convenience wrapper that returns just the hash (kept for compatibility).
 * Prefer `hashedPassword()` which returns {hash, salt} for new code.
 */
const hashOnly = async (password: string): Promise<string> => {
    const { hash } = await hashedPassword(password);
    return hash;
};

export const AuthUtils = {
    comparePasswords,
    hashedPassword,
    hashOnly,
    generateSalt,
};
