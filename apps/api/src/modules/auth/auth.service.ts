import { conflict, forbidden, unauthorized } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { isUniqueViolation } from '../../lib/prisma-errors.js';
import {
  generateRefreshToken,
  hashToken,
  REFRESH_TOKEN_TTL_MS,
  signAccessToken,
} from '../../lib/tokens.js';
import { toPublicUser } from '../users/users.mapper.js';
import { usersRepository } from '../users/users.repository.js';
import { refreshTokensRepository } from './auth.repository.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

const invalidCredentials = () => unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
const invalidRefreshToken = () =>
  unauthorized('INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');

function refreshExpiry() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
}

async function issueTokens(userId: string) {
  const accessToken = await signAccessToken(userId);
  const refreshToken = generateRefreshToken();
  await refreshTokensRepository.create({
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiry(),
  });
  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: RegisterInput) {
    try {
      const user = await usersRepository.create({
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
      });
      return toPublicUser(user);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw conflict('EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
      }
      throw err;
    }
  },

  async login(input: LoginInput) {
    const user = await usersRepository.findByEmail(input.email);
    if (!user) {
      await verifyAgainstDummy(input.password);
      throw invalidCredentials();
    }

    const passwordOk = await verifyPassword(input.password, user.passwordHash);
    if (!passwordOk) throw invalidCredentials();

    if (!user.isActive) {
      throw forbidden('ACCOUNT_DEACTIVATED', 'This account has been deactivated');
    }

    const tokens = await issueTokens(user.id);
    return { user: toPublicUser(user), ...tokens };
  },

  async refresh(rawToken: string | undefined) {
    if (!rawToken) throw invalidRefreshToken();

    const stored = await refreshTokensRepository.findByHashWithUser(hashToken(rawToken));
    if (!stored) throw invalidRefreshToken();

    // A token that was already rotated is being used again: likely stolen.
    if (stored.replacedByTokenId) {
      await refreshTokensRepository.revokeAllForUser(stored.userId);
      logger.warn({ userId: stored.userId }, 'Refresh token reuse detected, all sessions revoked');
      throw unauthorized('REFRESH_TOKEN_REUSED', 'Session is no longer valid, please log in again');
    }

    if (stored.revokedAt || stored.expiresAt <= new Date() || !stored.user.isActive) {
      throw invalidRefreshToken();
    }

    const newRefreshToken = generateRefreshToken();

    await prisma.$transaction(async (tx) => {
      const created = await refreshTokensRepository.create(
        {
          userId: stored.userId,
          tokenHash: hashToken(newRefreshToken),
          expiresAt: refreshExpiry(),
        },
        tx,
      );
      const rotated = await refreshTokensRepository.markReplaced(stored.id, created.id, tx);
      if (!rotated) throw invalidRefreshToken(); // a parallel refresh won; roll back
    });

    return {
      accessToken: await signAccessToken(stored.userId),
      refreshToken: newRefreshToken,
    };
  },

  async logout(rawToken: string | undefined) {
    if (rawToken) await refreshTokensRepository.revokeByHash(hashToken(rawToken));
  },
};
