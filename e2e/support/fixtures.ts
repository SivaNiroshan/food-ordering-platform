import { test as base, expect, type Browser, type Page } from '@playwright/test';
import { StaffApi } from './api';
import { STAFF } from './env';

export { expect };

/** The short order number shown everywhere: "#" + last 6 characters of the id. */
export function orderNumber(orderId: string) {
  return `#${orderId.slice(-6).toUpperCase()}`;
}

export async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Registers a brand-new customer through the UI and logs them in. */
export async function registerCustomer(page: Page) {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`;
  const password = 'Password123';
  await page.goto('/register');
  await page.getByLabel('Name').fill('E2E Customer');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/login/);
  await logIn(page, email, password);
  await expect(page).toHaveURL(/\/menu/);
  return { email, password };
}

/** A second, separate browser session for kitchen staff (own cookies, own socket). */
export async function openKitchen(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await logIn(page, STAFF.email, STAFF.password);
  await expect(page).toHaveURL(/\/kitchen/);
  return { page, close: () => context.close() };
}

/** Searches the menu for one dish, adds it, and places the order. Returns the order id. */
export async function placeOrder(page: Page, dishName: string, notes?: string) {
  await page.goto(`/menu?q=${encodeURIComponent(dishName)}`);
  await page.getByRole('button', { name: `Add ${dishName}` }).click();
  await page.getByRole('button', { name: 'Go to checkout' }).click();
  if (notes) await page.getByLabel('Notes for the kitchen (optional)').fill(notes);
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
  return page.url().split('/').pop()!;
}

/** The big status headline on the customer's order page. */
export function headline(page: Page) {
  return page.getByRole('heading', { level: 1 });
}

interface TestFixtures {
  /** A fresh dish on the menu, removed again after the test. */
  dish: { id: string; name: string };
}

interface WorkerFixtures {
  /** Logged in once per run, so the tests don't hit the login rate limit. */
  staffApi: StaffApi;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  staffApi: [
    // Playwright needs the object pattern here, even when the fixture uses no other fixtures.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, workerInfo) => {
      const api = await StaffApi.login(workerInfo.project.use.baseURL!);
      await use(api);
      await api.dispose();
    },
    { scope: 'worker' },
  ],
  dish: async ({ staffApi }, use, testInfo) => {
    const dish = await staffApi.createDish(`E2E ${testInfo.title.slice(0, 20).trim()}`);
    await use(dish);
    await staffApi.removeDish(dish.id);
  },
});
