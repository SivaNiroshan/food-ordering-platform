import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';

type Db = Prisma.TransactionClient;

export const refreshTokensRepository = {
  create(data: { userId: string; tokenHash: string; expiresAt: Date }, db: Db = prisma) {
    return db.refreshToken.create({ data });
  },

  findByHashWithUser(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
  },

  // Conditional update: succeeds only if nobody rotated this token first.
  async markReplaced(id: string, replacedByTokenId: string, db: Db = prisma) {
    const result = await db.refreshToken.updateMany({
      where: { id, replacedByTokenId: null, revokedAt: null },
      data: { replacedByTokenId, revokedAt: new Date() },
    });
    return result.count === 1;
  },

  revokeByHash(tokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  revokeAllForUser(userId: string, db: Db = prisma) {
    return db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};