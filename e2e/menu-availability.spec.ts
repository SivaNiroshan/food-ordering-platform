import { expect, logIn, registerCustomer, test } from './support/fixtures';
import { STAFF } from './support/env';

test('a sold-out dish can’t be added to the cart', async ({ page, staffApi, dish }) => {
  await staffApi.setAvailable(dish.id, false);

  await page.goto(`/menu?q=${encodeURIComponent(dish.name)}`);
  await expect(page.getByText('Sold out today')).toBeVisible();
  await expect(page.getByRole('button', { name: `Add ${dish.name}` })).toHaveCount(0);
});

test('if a dish sells out while it’s in the cart, checkout removes it and explains why', async ({
  page,
  staffApi,
  dish,
}) => {
  await registerCustomer(page);
  await page.goto(`/menu?q=${encodeURIComponent(dish.name)}`);
  await page.getByRole('button', { name: `Add ${dish.name}` }).click();
  await page.getByRole('button', { name: 'Go to checkout' }).click();

  // The kitchen runs out while the customer is on the checkout page.
  await staffApi.setAvailable(dish.id, false);
  await page.getByRole('button', { name: 'Place order' }).click();

  // It was the only item, so the order is now empty, but the customer is still told why.
  await expect(page.getByRole('heading', { name: 'Your order is empty' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(`${dish.name} is no longer available`);
});

test('a dish staff take off the menu disappears for customers', async ({ page, browser, dish }) => {
  await page.goto(`/menu?q=${encodeURIComponent(dish.name)}`);
  await expect(page.getByRole('heading', { name: dish.name })).toBeVisible();

  // Staff remove it through the Manage menu page.
  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  try {
    await logIn(staff, STAFF.email, STAFF.password);
    await staff.goto('/manage/menu');
    await staff.getByLabel('Search dishes').fill(dish.name);
    await staff.getByRole('button', { name: `Edit ${dish.name}` }).click();
    await staff.getByLabel(/Show on the menu/).uncheck();
    await staff.getByRole('button', { name: 'Save changes' }).click();
    await expect(staff.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  } finally {
    await staffContext.close();
  }

  await page.reload();
  await expect(page.getByRole('heading', { name: dish.name })).toHaveCount(0);
});
