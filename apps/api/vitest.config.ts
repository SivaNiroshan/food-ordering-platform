import { configDefaults, defineConfig } from 'vitest/config';

const testEnv = {
  NODE_ENV: 'test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  BCRYPT_ROUNDS: '4',
  LOG_LEVEL: 'silent',
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: [...configDefaults.exclude, 'src/**/*.int.test.ts'],
          env: { ...testEnv, DATABASE_URL: 'postgresql://test:test@localhost:5432/test' },
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.int.test.ts'],
          globalSetup: ['./test/global-setup.ts'],
          setupFiles: ['./test/setup-integration.ts'],
          env: testEnv,
          fileParallelism: false, // one shared database, so test files run one at a time
          hookTimeout: 120_000, // the first run downloads the PostgreSQL image
        },
      },
    ],
  },
});
