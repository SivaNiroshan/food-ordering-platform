import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import type { UserRole } from '../src/generated/prisma/enums.js';
import { hashPassword } from '../src/lib/password.js';
import { prisma } from '../src/lib/prisma.js';

const PASSWORD = 'Password123';

export async function createUserAndLogin(app: Express, role: UserRole) {
  const email = `${role.toLowerCase()}-${randomUUID()}@test.local`;
  const user = await prisma.user.create({
    data: {
      name: `Test ${role}`,
      email,
      emailNormalized: email,
      role,
      passwordHash: await hashPassword(PASSWORD),
    },
  });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);

  return { user, auth: { Authorization: `Bearer ${res.body.accessToken as string}` } };
}

export async function createCategory(overrides: { name?: string; isActive?: boolean } = {}) {
  const name = overrides.name ?? `Category ${randomUUID().slice(0, 8)}`;
  return prisma.category.create({
    data: { name, nameNormalized: name.toLowerCase(), isActive: overrides.isActive ?? true },
  });
}

export async function createMenuItem(
  categoryId: string,
  overrides: { name?: string; price?: string; isActive?: boolean; isAvailable?: boolean } = {},
) {
  return prisma.menuItem.create({
    data: {
      categoryId,
      name: overrides.name ?? `Item ${randomUUID().slice(0, 8)}`,
      price: overrides.price ?? '1000.00',
      isActive: overrides.isActive ?? true,
      isAvailable: overrides.isAvailable ?? true,
    },
  });
}
