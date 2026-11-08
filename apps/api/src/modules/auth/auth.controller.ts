import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { unauthorized } from '../../lib/errors.js';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_MS } from '../../lib/tokens.js';
import { getAuthUser } from '../../middleware/authenticate.js';
import { toPublicUser } from '../users/users.mapper.js';
import { usersRepository } from '../users/users.repository.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import { authService } from './auth.service.js';

const REFRESH_COOKIE = 'refresh_token';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/v1/auth',
};

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

export const authController = {
  async register(req: Request, res: Response) {
    const input = registerSchema.parse(req.body);
    const user = await authService.register(input);
    res.status(201).json(user);
  },

  async login(req: Request, res: Response) {
    const input = loginSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.login(input);
    res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions, maxAge: REFRESH_TOKEN_TTL_MS });
    res.json({ accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS, user });
  },

  async refresh(req: Request, res: Response) {
    const { accessToken, refreshToken } = await authService.refresh(readRefreshCookie(req));
    res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions, maxAge: REFRESH_TOKEN_TTL_MS });
    res.json({ accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS });
  },

  async logout(req: Request, res: Response) {
    await authService.logout(readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    res.status(204).end();
  },

  async me(req: Request, res: Response) {
    const user = await usersRepository.findById(getAuthUser(req).id);
    if (!user) throw unauthorized('INVALID_ACCESS_TOKEN', 'Access token is invalid');
    res.json(toPublicUser(user));
  },
};
