import type { FullConfig } from '@playwright/test';
import { StaffApi } from './support/api';

/** Hides the "E2E tests" category so test dishes never show on your real menu. */
export default async function globalTeardown(config: FullConfig) {
  const api = await StaffApi.login(config.projects[0]?.use.baseURL ?? 'http://localhost:5173');
  await api.hideE2eCategory();
  await api.dispose();
}
