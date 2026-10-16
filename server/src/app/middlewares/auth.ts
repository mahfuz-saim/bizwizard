import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import ApiError from '../../errors/ApiError';
import { JWTHelper } from '../../helpers/jwtHelpers';
import { JwtPayload } from '../../interfaces/common';

const auth =
    (...requiredRoles: string[]) =>
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            //get authorization token - accepts "Bearer <token>" or raw token
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                throw new ApiError(
                    httpStatus.UNAUTHORIZED,
                    'You are not authorized',
                );
            }
            const token = authHeader.startsWith('Bearer ')
                ? authHeader.slice(7)
                : authHeader;
            // verify token
            let verifiedUser = null;

            verifiedUser = JWTHelper.verifyToken(
                token,
                config.jwt.secret as Secret,
            ) as JwtPayload;

            req.user = verifiedUser as JwtPayload;

            if (
                requiredRoles.length &&
                !requiredRoles.includes(verifiedUser.role)
            ) {
                throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
            }
            next();
        } catch (error) {
            next(error);
        }
    };

export default auth;
