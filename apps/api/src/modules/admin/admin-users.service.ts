import type { Prisma } from '../../generated/prisma/client.js';
import type { UserRole } from '../../generated/prisma/enums.js';
import { conflict, notFound } from '../../lib/errors.js';
import { toPage, toSkipTake } from '../../lib/pagination.js';
import { hashPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { isRecordNotFound, isUniqueViolation } from '../../lib/prisma-errors.js';
import { refreshTokensRepository } from '../auth/auth.repository.js';
import { toPublicUser } from '../users/users.mapper.js';
import { usersRepository } from '../users/users.repository.js';
import type { CreateStaffUserInput, ListUsersQuery } from './admin-users.schemas.js';

const userNotFound = () => notFound('USER_NOT_FOUND', 'User not found');

function assertNotSelf(adminId: string, targetId: string) {
  // Prevents an admin from locking themselves (and possibly everyone) out.
  if (adminId === targetId) {
    throw conflict('CANNOT_MODIFY_SELF', 'You cannot change your own role or status');
  }
}

/** Updates the user and revokes all their sessions in one transaction. */
async function updateAndRevokeSessions(userId: string, data: Prisma.UserUpdateInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id: userId }, data });
      await refreshTokensRepository.revokeAllForUser(userId, tx);
      return user;
    });
  } catch (err) {
    if (isRecordNotFound(err)) throw userNotFound();
    throw err;
  }
}

export const adminUsersService = {
  async list(query: ListUsersQuery) {
    const where: Prisma.UserWhereInput = {
      ...(query.role && { role: query.role }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const { users, total } = await usersRepository.list({ where, ...toSkipTake(query) });
    return toPage(users.map(toPublicUser), total, query);
  },

  async get(id: string) {
    const user = await usersRepository.findById(id);
    if (!user) throw userNotFound();
    return toPublicUser(user);
  },

  async createStaffUser(input: CreateStaffUserInput) {
    try {
      const user = await usersRepository.create({
        name: input.name,
        email: input.email,
        role: input.role,
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

  async changeRole(adminId: string, userId: string, role: UserRole) {
    assertNotSelf(adminId, userId);
    return toPublicUser(await updateAndRevokeSessions(userId, { role }));
  },

  async changeStatus(adminId: string, userId: string, isActive: boolean) {
    assertNotSelf(adminId, userId);
    return toPublicUser(await updateAndRevokeSessions(userId, { isActive }));
  },
};