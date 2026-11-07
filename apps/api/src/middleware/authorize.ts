import type { RequestHandler } from 'express';
import type { UserRole } from '../generated/prisma/enums.js';
import { forbidden } from '../lib/errors.js';
import { getAuthUser } from './authenticate.js';

export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    const user = getAuthUser(req);
    if (!roles.includes(user.role)) {
      throw forbidden('FORBIDDEN', 'You do not have permission to perform this action');
    }
    next();
  };