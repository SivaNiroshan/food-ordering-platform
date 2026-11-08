import type { UserRole } from '../../generated/prisma/enums.js';
import { prisma } from '../../lib/prisma.js';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const usersRepository = {
  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  },
  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { emailNormalized: normalizeEmail(email) },
    });
  },
  create(data: { name: string; email: string; passwordHash: string; role?: UserRole }) {
    return prisma.user.create({
      data: { ...data, emailNormalized: normalizeEmail(data.email) },
    });
  },
};
