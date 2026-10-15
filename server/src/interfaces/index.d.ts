/* eslint-disable @typescript-eslint/consistent-type-definitions */

import { JwtPayload } from './common';

declare global {
    namespace Express {
        interface Request {
            user: JwtPayload | null;
            tenantId: string | null;
        }
    }
}
