import { APIRequestContext, Page, expect } from '@playwright/test';

const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
export const API = (process.env['E2E_API_URL'] ?? new URL('/api', baseURL).toString()).replace(
  /\/$/,
  '',
);

export const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'];
export const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'];
export const HAS_ADMIN = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);

export const PASSWORD = 'Passw0rd!1';

/** A new customer every time, so a run never depends on what an earlier run left behind. */
export function newCustomer() {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return {
    name: `E2E Customer ${id}`,
    email: `e2e-${id}@example.com`,
    phone: '01012345678',
    password: PASSWORD,
  };
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
  await page.locator('form button[type="submit"]').click();
  // signed in: the site leaves the register page (works in either language and on a phone)
  await expect(page).not.toHaveURL(/\/register/);
  return customer;
}

/**
 * The product with the most stock. Tests order products, and a database that lives across runs (or many tests in
 * one run) would otherwise sell the first product out and make every later test fail for the wrong reason.
 */
export async function pickProductId(request: APIRequestContext): Promise<number> {
  const catalogue = await (await request.get(`${API}/products?pageSize=50`)).json();
  const details = await Promise.all(
    (catalogue.items as { id: number }[]).map(async ({ id }) =>
      (await request.get(`${API}/products/${id}`)).json(),
    ),
  );
  const best = details.sort((a, b) => b.stockQuantity - a.stockQuantity)[0];
  expect(best?.stockQuantity, 'the shop needs at least one product in stock').toBeGreaterThan(1);
  return best.id;
}

/** Opens a product that is in stock (from the catalogue page, like a visitor) and returns its id. */
export async function openFirstProduct(page: Page): Promise<number> {
  const id = await pickProductId(page.request);
  await page.goto('/products');
  const card = page.locator(`a[href="/products/${id}"]`).first();
  await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();
  if (await card.isVisible()) await card.click();
  else await page.goto(`/products/${id}`);
  await expect(page).toHaveURL(new RegExp(`/products/${id}$`));
  return id;
}

/** Signs in as the shop owner through the API and returns an authenticated helper. */
export async function adminApi(request: APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { 'X-Client-App': 'admin' },
  });
  expect(
    login.ok(),
    'the admin account must exist (Seed__AdminEmail / Seed__AdminPassword)',
  ).toBeTruthy();
  const { accessToken } = await login.json();
  const headers = { Authorization: `Bearer ${accessToken}` };

  return {
    async setStatus(orderId: number, status: string) {
      const response = await request.post(`${API}/admin/orders/${orderId}/status`, {
        headers,
        data: { status },
      });
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

/** A customer created through the API (no browser), with a token for further API calls. */
export async function apiCustomer(request: APIRequestContext) {
  const customer = newCustomer();
  const response = await request.post(`${API}/auth/register`, {
    data: {
      email: customer.email,
      password: customer.password,
      fullName: customer.name,
      phone: customer.phone,
    },
  });
  expect(response.status(), 'registering through the API').toBe(201);
  const { accessToken } = await response.json();
  const headers = { Authorization: `Bearer ${accessToken}` };

  return {
    ...customer,
    headers,
    /** Puts the first catalogue product in the cart and orders it. Returns the order id and product id. */
    async order(shippingName = customer.name): Promise<{ orderId: number; productId: number }> {
      const productId = await pickProductId(request);
      const add = await request.post(`${API}/cart/items`, {
        headers,
        data: { productId, quantity: 1 },
      });
      expect(add.ok(), 'adding to the cart').toBeTruthy();
      const placed = await request.post(`${API}/orders`, {
        headers,
        data: {
          shippingName,
          phone: customer.phone,
          address: '12 Nile Street, Dokki',
          city: 'Giza',
        },
      });
      expect(placed.status(), 'placing the order').toBe(201);
      return { orderId: (await placed.json()).id, productId };
    },
    async getOrder(orderId: number) {
      return (await request.get(`${API}/orders/${orderId}`, { headers })).json();
    },
    async review(productId: number, rating: number, comment: string) {
      const response = await request.put(`${API}/products/${productId}/reviews`, {
        headers,
        data: { rating, comment },
      });
      expect(response.status(), 'saving the review').toBe(204);
    },
  };
}

/** Throws if the page can be scrolled sideways (something is wider than the screen). */
export async function expectNoSideScroll(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  }));
  expect(
    overflow.scroll,
    `${where} is wider than the screen (${overflow.scroll} > ${overflow.width})`,
  ).toBeLessThanOrEqual(overflow.width + 1);
}
