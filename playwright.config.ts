import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests: real browser → web app (Vite) → API → Postgres/Redis → worker.
 * The API and worker must already be running (see e2e/README.md). Vite is started
 * here if it isn't running yet.
 */
export default defineConfig({
  testDir: './e2e',
  // One worker: every test shares the same database and kitchen board.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -w @foodflow/web',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});