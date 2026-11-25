import { APIRequestContext, Page, expect } from '@playwright/test';

const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
export const API = (process.env['E2E_API_URL'] ?? new URL('/api', baseURL).toString()).replace(/\/$/, '');

export const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'];
export const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'];
export const HAS_ADMIN = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);

export const PASSWORD = 'Passw0rd!1';

/** A new customer every time, so a run never depends on what an earlier run left behind. */
export function newCustomer() {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { name: `E2E Customer ${id}`, email: `e2e-${id}@example.com`, phone: '01012345678', password: PASSWORD };
}

/** The site starts in Arabic; the tests read English labels. */
export async function useLanguage(page: Page, lang: 'en' | 'ar'): Promise<void> {
  await page.addInitScript((value) => localStorage.setItem('craftycorner.lang', value), lang);
}

export async function register(page: Page, customer = newCustomer()) {
  await page.goto('/register');
  await page.locator('#reg-name').fill(customer.name);
  await page.locator('#reg-email').fill(customer.email);
  await page.locator('#reg-phone').fill(customer.phone);
  await page.locator('#reg-password').fill(customer.password);
  await page.locator('#reg-confirm').fill(customer.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  // a signed-in customer sees the account link instead of the sign-in one
  await expect(page.locator('a[href="/account"]').first()).toBeVisible();
  return customer;
}

/** Opens the first product in the catalogue and returns its id. */
export async function openFirstProduct(page: Page): Promise<number> {
  await page.goto('/products');
  const first = page.locator('a[href^="/products/"]').first();
  await expect(first).toBeVisible();
  const href = (await first.getAttribute('href'))!;
  await first.click();
  await expect(page).toHaveURL(/\/products\/\d+$/);
  return Number(href.split('/').pop());
}

/** Signs in as the shop owner through the API and returns an authenticated helper. */
export async function adminApi(request: APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { 'X-Client-App': 'admin' },
  });
  expect(login.ok(), 'the admin account must exist (Seed__AdminEmail / Seed__AdminPassword)').toBeTruthy();
  const { accessToken } = await login.json();
  const headers = { Authorization: `Bearer ${accessToken}` };

  return {
    async setStatus(orderId: number, status: string) {
      const response = await request.post(`${API}/admin/orders/${orderId}/status`, { headers, data: { status } });
      expect(response.ok(), `moving order ${orderId} to ${status}`).toBeTruthy();
    },
    async setTracking(orderId: number, company: string, number: string) {
      const response = await request.put(`${API}/admin/orders/${orderId}/tracking`, {
        headers,
        data: { company, number },
      });
      expect(response.ok(), 'saving the tracking number').toBeTruthy();
    },
  };
}
