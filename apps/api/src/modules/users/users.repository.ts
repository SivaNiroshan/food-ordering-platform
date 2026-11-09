import type { Prisma } from '../../generated/prisma/client.js';
import type { UserRole } from '../../generated/prisma/enums.js';
import { prisma } from '../../lib/prisma.js';

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export const usersRepository = {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { emailNormalized: normalizeEmail(email) } });
  },

  create(data: { name: string; email: string; passwordHash: string; role?: UserRole }) {
    return prisma.user.create({
      data: { ...data, emailNormalized: normalizeEmail(data.email) },
    });
  },

  async list(params: { where: Prisma.UserWhereInput; skip: number; take: number }) {
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where: params.where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      prisma.user.count({ where: params.where }),
    ]);
    return { users, total };
  },

  update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data });
  },
};