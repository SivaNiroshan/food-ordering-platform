import {
  expect,
  headline,
  openKitchen,
  orderNumber,
  placeOrder,
  registerCustomer,
  test,
} from './support/fixtures';

test('an order goes from placed to collected, and the customer sees every step live', async ({
  page,
  browser,
  dish,
}) => {
  await registerCustomer(page);
  const orderId = await placeOrder(page, dish.name, 'Less spicy please');
  const number = orderNumber(orderId);

  await expect(headline(page)).toHaveText('Waiting for the kitchen to accept');
  await expect(page.getByText('Live updates on')).toBeVisible();

  const kitchen = await openKitchen(browser);
  try {
    const ticket = kitchen.page.getByRole('article', { name: number });
    await expect(ticket).toContainText(dish.name);
    await expect(ticket).toContainText('Less spicy please');

    // Each step: staff clicks once, and the customer's page changes WITHOUT a reload.
    const steps = [
      { button: 'Accept', customerSees: 'The kitchen has accepted your order' },
      { button: 'Start preparing', customerSees: 'Your food is being prepared' },
      { button: 'Mark ready', customerSees: 'Ready to collect' },
      { button: 'Mark collected', customerSees: 'Collected. Enjoy your meal!' },
    ];
    for (const step of steps) {
      await kitchen.page.getByRole('button', { name: `${step.button}: order ${number}` }).click();
      await expect(headline(page)).toHaveText(step.customerSees);
    }

    // Collected orders leave the board and show up in the kitchen's history.
    await expect(ticket).toHaveCount(0);
    await kitchen.page.getByRole('button', { name: 'Finished orders' }).click();
    await expect(kitchen.page.getByText(number)).toBeVisible();
  } finally {
    await kitchen.close();
  }

  // The customer's order list shows the final status too.
  await page.getByRole('link', { name: 'My orders' }).click();
  await expect(page.getByRole('link', { name: new RegExp(number) })).toContainText('Collected');
});