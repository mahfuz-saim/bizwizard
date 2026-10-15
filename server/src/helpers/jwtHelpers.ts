import jwt, { Secret, SignOptions, JwtPayload } from 'jsonwebtoken';

const createToken = (
    payload: Record<string, unknown>,
    secret: Secret,
    expireTime: any,
): string => {
    const options: SignOptions = {
        algorithm: 'HS256',
        expiresIn: expireTime,
    };

    return jwt.sign(payload, secret, options);
};

const verifyToken = (token: string, secret: Secret): JwtPayload | string => {
    return jwt.verify(token, secret);
};

export const JWTHelper = {
    createToken,
    verifyToken,
};
