# End-to-end tests

Real browser → web app → API → Postgres/Redis → worker. They check the flows that matter
most: placing an order, live status updates, the kitchen board, cancel/reject, sold-out
dishes and role-based access.

## Run them

1. Start Postgres and Redis (`docker compose up -d`).
2. Make sure the database is migrated and seeded (the tests log in as `staff@foodflow.local`).
3. Raise the login rate limit: set `AUTH_RATE_LIMIT_PER_MINUTE=100` in `.env`. The default
   (5 a minute) is far below the ~20 logins/registrations one run makes, and every test
   after the fifth would fail with `Staff login failed (429)`.
4. Start the API and the worker, each in its own terminal, as you do for development
   (restart the API if it was already running, so it picks up the new limit).
5. From the repo root:

```bash
npm run test:e2e        # headless
npm run test:e2e:ui     # Playwright's UI: watch each step, time-travel through it
```

Vite is started automatically if it isn't already running.

## Good to know

- Tests create their own customer accounts and dishes (in an "E2E tests" category), so
  they don't depend on, or change, your seed data. The category is hidden after the run.
- They run one at a time, because they share one database and one kitchen board.
- If your seeded staff account uses a different password, set `E2E_STAFF_EMAIL` /
  `E2E_STAFF_PASSWORD`.
- On failure, Playwright keeps a trace: `npx playwright show-trace test-results/<test>/trace.zip`.
