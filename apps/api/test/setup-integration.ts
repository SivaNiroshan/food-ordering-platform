import { afterAll, beforeEach, inject } from 'vitest';

// Must be set BEFORE anything imports src/config/env.ts
process.env.DATABASE_URL = inject('databaseUrl');

const { prisma } = await import('../src/lib/prisma.js');

beforeEach(async () => {
  await prisma.$executeRaw`TRUNCATE TABLE order_status_history, order_items, orders, menu_items, categories, refresh_tokens, users CASCADE`;
});

afterAll(async () => {
  await prisma.$disconnect();
});
