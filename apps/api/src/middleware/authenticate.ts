import type { Request, RequestHandler } from 'express';
import { errors } from 'jose';
import { unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { usersRepository } from '../modules/users/users.repository.js';

export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('UNAUTHENTICATED', 'Authentication required');
  }

  let userId: string;
  try {
    userId = await verifyAccessToken(header.slice('Bearer '.length));
  } catch (err) {
    if (err instanceof errors.JWTExpired) {
      throw unauthorized('ACCESS_TOKEN_EXPIRED', 'Access token has expired');
    }
    throw unauthorized('INVALID_ACCESS_TOKEN', 'Access token is invalid');
  }

  const user = await usersRepository.findById(userId);
  if (!user || !user.isActive) {
    throw unauthorized('INVALID_ACCESS_TOKEN', 'Access token is invalid');
  }

  req.user = { id: user.id, role: user.role };
  next();
};

export function getAuthUser(req: Request) {
  if (!req.user) throw unauthorized('UNAUTHENTICATED', 'Authentication required');
  return req.user;
}
