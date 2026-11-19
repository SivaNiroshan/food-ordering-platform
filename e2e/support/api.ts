import { request, type APIRequestContext } from '@playwright/test';
import { E2E_CATEGORY, STAFF } from './env';

/**
 * Talks to the API directly (through the same Vite proxy the browser uses) to set up
 * test data quickly. Only the things being tested go through the UI.
 */
export class StaffApi {
  private constructor(
    private readonly http: APIRequestContext,
    private readonly token: string,
  ) {}

  static async login(baseURL: string) {
    const http = await request.newContext({ baseURL });
    const res = await http.post('/api/v1/auth/login', { data: STAFF });
    if (res.status() === 429) {
      throw new Error(
        'Staff login was rate-limited (429). Set AUTH_RATE_LIMIT_PER_MINUTE=100 in .env and restart the API (see e2e/README.md).',
      );
    }
    if (!res.ok()) {
      throw new Error(
        `Staff login failed (${res.status()}). Is the API seeded? Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD if your seed uses different details.`,
      );
    }
    const body = (await res.json()) as { accessToken: string };
    return new StaffApi(http, body.accessToken);
  }

  private async call<T>(method: 'GET' | 'POST' | 'PATCH', path: string, data?: unknown) {
    const res = await this.http.fetch(`/api/v1${path}`, {
      method,
      data,
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok()) throw new Error(`${method} ${path} → ${res.status()}: ${await res.text()}`);
    return (await res.json()) as T;
  }

  /** Finds the E2E category (creating it the first time) and makes sure it's visible. */
  async e2eCategory() {
    const categories = await this.call<{ id: string; name: string; isActive: boolean }[]>(
      'GET',
      '/staff/categories',
    );
    const existing = categories.find((c) => c.name.toLowerCase() === E2E_CATEGORY.toLowerCase());
    if (!existing) {
      return this.call<{ id: string }>('POST', '/staff/categories', { name: E2E_CATEGORY });
    }
    if (!existing.isActive) {
      await this.call('PATCH', `/staff/categories/${existing.id}`, { isActive: true });
    }
    return existing;
  }

  async hideE2eCategory() {
    const categories = await this.call<{ id: string; name: string }[]>('GET', '/staff/categories');
    const existing = categories.find((c) => c.name.toLowerCase() === E2E_CATEGORY.toLowerCase());
    if (existing) await this.call('PATCH', `/staff/categories/${existing.id}`, { isActive: false });
  }

  /** A new dish with a unique name, so each test has its own and can search for it. */
  async createDish(label: string, price = '1500.00') {
    const category = await this.e2eCategory();
    const name = `${label} ${Date.now().toString(36)}`;
    return this.call<{ id: string; name: string; price: string }>('POST', '/staff/menu-items', {
      categoryId: category.id,
      name,
      price,
      description: 'Created by an end-to-end test',
      isAvailable: true,
    });
  }

  setAvailable(dishId: string, isAvailable: boolean) {
    return this.call('PATCH', `/staff/menu-items/${dishId}`, { isAvailable });
  }

  /** Takes a dish off the menu (past orders keep it). */
  removeDish(dishId: string) {
    return this.call('PATCH', `/staff/menu-items/${dishId}`, { isActive: false });
  }

  dispose() {
    return this.http.dispose();
  }
}
