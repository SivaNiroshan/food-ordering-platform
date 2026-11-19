/** Accounts created by the API's seed script. Override with env vars if yours differ. */
export const STAFF = {
  email: process.env.E2E_STAFF_EMAIL ?? 'staff@foodflow.local',
  password: process.env.E2E_STAFF_PASSWORD ?? 'Password123',
};

/** All test dishes go in this category, so they're easy to spot and hide. */
export const E2E_CATEGORY = 'E2E tests';
