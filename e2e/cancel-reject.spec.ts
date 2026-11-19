import {
  expect,
  headline,
  openKitchen,
  orderNumber,
  placeOrder,
  registerCustomer,
  test,
} from './support/fixtures';

test('a customer can cancel an order the kitchen hasn’t accepted yet', async ({ page, dish }) => {
  await registerCustomer(page);
  await placeOrder(page, dish.name);

  await page.getByRole('button', { name: 'Cancel order' }).click();
  await page.getByRole('button', { name: 'Yes, cancel it' }).click();

  await expect(headline(page)).toHaveText('This order was cancelled');
  await expect(page.getByText('You cancelled this order.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
});

test('when the kitchen rejects an order, the customer sees why straight away', async ({
  page,
  browser,
  dish,
}) => {
  await registerCustomer(page);
  const number = orderNumber(await placeOrder(page, dish.name));

  const kitchen = await openKitchen(browser);
  try {
    await kitchen.page.getByRole('button', { name: `Reject order ${number}` }).click();
    await kitchen.page.getByLabel('The kitchen is too busy').check();
    await kitchen.page.getByLabel(/Note for the customer/).fill('Back to normal in an hour');
    await kitchen.page.getByRole('button', { name: 'Reject order' }).click();
    await expect(kitchen.page.getByRole('article', { name: number })).toHaveCount(0);
  } finally {
    await kitchen.close();
  }

  await expect(headline(page)).toHaveText('The kitchen couldn’t take this order');
  await expect(page.getByText('The kitchen is too busy right now.')).toBeVisible();
  await expect(page.getByText('Back to normal in an hour')).toBeVisible();
});

test('once the kitchen accepts, the customer can no longer cancel', async ({
  page,
  browser,
  dish,
}) => {
  await registerCustomer(page);
  const number = orderNumber(await placeOrder(page, dish.name));

  const kitchen = await openKitchen(browser);
  try {
    await kitchen.page.getByRole('button', { name: `Accept: order ${number}` }).click();
    await expect(headline(page)).toHaveText('The kitchen has accepted your order');
    await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
    // Tidy up so the order doesn't stay on the board.
    for (const step of ['Start preparing', 'Mark ready', 'Mark collected']) {
      await kitchen.page.getByRole('button', { name: `${step}: order ${number}` }).click();
    }
    await expect(kitchen.page.getByRole('article', { name: number })).toHaveCount(0);
  } finally {
    await kitchen.close();
  }
});
