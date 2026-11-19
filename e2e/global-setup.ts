import type { FullConfig } from '@playwright/test';

/** Fails fast with a clear message when the API isn't running, instead of 20 confusing timeouts. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:5173';
  try {
    const res = await fetch(`${baseURL}/api/v1/categories`);
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (err) {
    throw new Error(
      `The API isn't reachable through ${baseURL} (${String(err)}).\n` +
        'Start Postgres + Redis, the API and the worker before running the E2E tests (see e2e/README.md).',
      { cause: err },
    );
  }
}
