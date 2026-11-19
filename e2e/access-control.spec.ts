import { expect, registerCustomer, test } from './support/fixtures';

test('guests are sent to log in for pages that need an account', async ({ page }) => {
  for (const path of ['/orders', '/checkout', '/kitchen', '/admin/users']) {
    await page.goto(path);
    await expect(page, `guest opening ${path}`).toHaveURL(/\/login$/);
  }
});

test('customers can’t open staff or admin pages', async ({ page }) => {
  await registerCustomer(page);
  for (const path of ['/kitchen', '/manage/menu', '/admin/users']) {
    await page.goto(path);
    await expect(page, `customer opening ${path}`).toHaveURL(/\/menu$/);
  }
  await expect(page.getByRole('link', { name: 'Kitchen' })).toHaveCount(0);
});

test('the API refuses a customer token on staff endpoints, not only the UI', async ({
  page,
  request,
}) => {
  const { email, password } = await registerCustomer(page);
  const login = await request.post('/api/v1/auth/login', { data: { email, password } });
  const { accessToken } = (await login.json()) as { accessToken: string };

  const res = await request.get('/api/v1/staff/orders', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(res.status()).toBe(403);
});
