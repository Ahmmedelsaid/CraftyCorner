import { expect, test } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  HAS_ADMIN,
  apiCustomer,
  expectNoSideScroll,
  useLanguage,
} from './helpers';

test.skip(!HAS_ADMIN, 'set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run the dashboard tests');

/** The owner dashboard on a phone: the side menu opens from a button, and no page sticks out sideways. */
test.describe('dashboard on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await useLanguage(page, 'en');
    await page.goto('/login');
    await expectNoSideScroll(page, 'the sign-in page');
    await page.locator('#admin-email').fill(ADMIN_EMAIL!);
    await page.locator('#admin-password').fill(ADMIN_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).tap();
    // the dashboard code is fetched on first use by the dev server: allow it time
    await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('the side menu is closed until the menu button is tapped, then opens and navigates', async ({
    page,
  }) => {
    const nav = page.getByRole('navigation', { name: 'Dashboard' });
    await expect(nav).not.toBeInViewport();

    await page.getByRole('button', { name: 'Dashboard' }).tap();
    await expect(nav).toBeInViewport();

    await nav.getByRole('link', { name: /^Products/ }).tap();
    await expect(page.getByRole('heading', { name: 'Products', level: 1 })).toBeVisible();
  });

  test('every dashboard page fits the screen', async ({ page, request }) => {
    const customer = await apiCustomer(request);
    const { orderId } = await customer.order();

    for (const path of [
      '/',
      '/orders',
      `/orders/${orderId}`,
      '/products',
      '/products/new',
      '/categories',
      '/reviews',
      '/messages',
      '/team',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expect(page.getByText('Something went wrong')).toHaveCount(0);
      await expectNoSideScroll(page, `the dashboard page ${path}`);
    }
  });

  test('an order can be confirmed with a tap', async ({ page, request }) => {
    const customer = await apiCustomer(request);
    const { orderId } = await customer.order();

    await page.goto(`/orders/${orderId}`);
    await page.getByRole('button', { name: 'Confirm order' }).tap();

    await expect(page.getByText('Order status updated.').first()).toBeVisible();
    expect((await customer.getOrder(orderId)).status).toBe('Confirmed');
  });
});
