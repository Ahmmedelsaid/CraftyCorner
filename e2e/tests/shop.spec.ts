import { expect, test } from '@playwright/test';
import {
  HAS_ADMIN,
  adminApi,
  newCustomer,
  openFirstProduct,
  register,
  useLanguage,
} from './helpers';

const ARABIC = /[؀-ۿ]/;

test.describe('visitor', () => {
  test('browses the catalogue in Arabic and in English', async ({ page }) => {
    await useLanguage(page, 'ar');
    await page.goto('/products');
    const firstCard = page.locator('a[href^="/products/"]').first();
    await expect(firstCard).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(firstCard).toContainText(ARABIC);

    // switching language flips direction and shows the English names the owner entered
    await page
      .locator('button', { hasText: /^\s*(EN|English)\s*$/ })
      .first()
      .click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(firstCard).not.toContainText(ARABIC);
  });

  test('sees a product page with its price and an add-to-cart button', async ({ page }) => {
    await useLanguage(page, 'en');
    await openFirstProduct(page);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
    await expect(page.getByRole('heading', { name: 'Ratings and reviews' })).toBeVisible();
  });

  test('is sent to sign in when opening the cart, checkout, orders, account or favourites', async ({
    page,
  }) => {
    await useLanguage(page, 'en');
    for (const path of ['/cart', '/checkout', '/orders', '/account', '/wishlist']) {
      await page.goto(path);
      await expect(page, `${path} should ask for a login`).toHaveURL(/\/login/);
    }
  });

  test('the shop has no link to the dashboard, and the owner account cannot sign in to it', async ({
    page,
  }) => {
    test.skip(!HAS_ADMIN, 'set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to try the owner account');
    await useLanguage(page, 'en');
    await page.goto('/login');
    await page
      .locator('#login-email, input[type="email"]')
      .first()
      .fill(process.env['E2E_ADMIN_EMAIL']!);
    await page.locator('input[type="password"]').first().fill(process.env['E2E_ADMIN_PASSWORD']!);
    await page.locator('form button[type="submit"]').click();

    await expect(page.getByRole('alert')).toContainText('Incorrect email or password');
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
    await expect(page.locator('a[href="/account"]')).toHaveCount(0);
  });

  test('cannot register with a weak password or a wrong phone number', async ({ page }) => {
    await useLanguage(page, 'en');
    await page.goto('/register');
    await page.locator('#reg-name').fill('Weak Password');
    await page.locator('#reg-email').fill(newCustomer().email);
    await page.locator('#reg-phone').fill('12345');
    await page.locator('#reg-password').fill('short');
    await page.locator('#reg-confirm').fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('#reg-phone-error')).toBeVisible();
  });
});

test.describe('customer', () => {
  test('saves a product to favourites and sees it on the favourites page', async ({ page }) => {
    await useLanguage(page, 'en');
    await register(page);
    const productId = await openFirstProduct(page);

    const heart = page.getByRole('button', { name: 'Save to favourites' });
    // the heart turns red at once; wait for the server to have saved it before leaving the page
    const saved = page.waitForResponse(
      (r) => r.url().includes('/wishlist/') && r.request().method() === 'PUT',
    );
    await heart.click();
    await expect(page.getByRole('button', { name: 'Remove from favourites' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect((await saved).ok()).toBeTruthy();

    await page.goto('/wishlist');
    await expect(page.locator(`a[href="/products/${productId}"]`).first()).toBeVisible();

    // and it is still there after a reload (saved on the account, not just in the page)
    await page.reload();
    await expect(page.locator(`a[href="/products/${productId}"]`).first()).toBeVisible();

    await page.locator(`a[href="/products/${productId}"]`).first().click();
    const removed = page.waitForResponse(
      (r) => r.url().includes('/wishlist/') && r.request().method() === 'DELETE',
    );
    await page.getByRole('button', { name: 'Remove from favourites' }).click();
    expect((await removed).ok()).toBeTruthy();
    await page.goto('/wishlist');
    await expect(page.getByText('Nothing saved yet')).toBeVisible();
  });

  test('cannot review a product before it was delivered', async ({ page }) => {
    await useLanguage(page, 'en');
    await register(page);
    await openFirstProduct(page);

    await expect(
      page.getByText('You can review this product after it is delivered to you.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit review' })).toHaveCount(0);
  });

  test('registers, orders a product, follows it to delivery and reviews it', async ({
    page,
    request,
  }) => {
    await useLanguage(page, 'en');

    // ----- sign up
    const customer = await register(page);

    // ----- choose a product and put it in the cart
    const productId = await openFirstProduct(page);
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByRole('link', { name: 'Shopping cart' })).toContainText('1');

    // ----- cart, then checkout
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Order summary' })).toBeVisible();
    // the delivery fee (EGP 100 for now) is part of what the customer pays
    await expect(page.locator('dl').filter({ hasText: 'Shipping' })).toContainText('EGP 100');
    await page.getByRole('link', { name: 'Checkout' }).click();
    await expect(page).toHaveURL(/\/checkout/);

    // the name and phone come from the account
    await expect(page.locator('#co-name')).toHaveValue(customer.name);
    await expect(page.locator('#co-phone')).toHaveValue(customer.phone);
    await page.locator('#co-city').selectOption('Giza');
    await page.locator('#co-address').fill('12 Nile Street, Dokki, building 3, floor 2');
    await page.getByRole('button', { name: 'Place order' }).click();

    // ----- confirmation
    await expect(page).toHaveURL(/\/orders\/\d+\?placed=1/);
    await expect(
      page.getByRole('heading', { name: 'Thank you! Your order is placed.' }),
    ).toBeVisible();
    const orderId = Number(new URL(page.url()).pathname.split('/').pop());
    await expect(page.getByText('New order').first()).toBeVisible();

    // ----- it is in the order history, the cart is empty, and "save as default" filled the account
    await page.goto('/orders');
    await expect(page.locator(`a[href="/orders/${orderId}"]`).first()).toBeVisible();
    await page.goto('/cart');
    await expect(page.getByText('Your cart is empty')).toBeVisible();
    await page.goto('/account');
    await expect(page.locator('textarea').first()).toHaveValue(/12 Nile Street/);

    // ----- the owner works the order (needs an admin account)
    test.skip(!HAS_ADMIN, 'set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run the owner steps');
    const admin = await adminApi(request);
    for (const status of ['Confirmed', 'Preparing']) await admin.setStatus(orderId, status);
    await admin.setStatus(orderId, 'Shipped');
    await admin.setTracking(orderId, 'Bosta', 'E2E-TRACK-777');

    // ----- the customer sees the shipment, and still cannot review
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByText('Shipment tracking')).toBeVisible();
    await expect(page.getByText('E2E-TRACK-777')).toBeVisible();
    await expect(page.getByText('Bosta')).toBeVisible();
    await page.goto(`/products/${productId}`);
    await expect(
      page.getByText('You can review this product after it is delivered to you.'),
    ).toBeVisible();

    // ----- delivered: now the review form appears
    await admin.setStatus(orderId, 'Delivered');
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByText('Delivered').first()).toBeVisible();

    await page.goto(`/products/${productId}`);
    await page.getByRole('radio', { name: '5 / 5' }).click();
    await page
      .getByPlaceholder('Tell others what you think (optional)')
      .fill('Beautiful and well made, thank you!');
    await page.getByRole('button', { name: 'Submit review' }).click();

    await expect(page.getByText('Beautiful and well made, thank you!')).toBeVisible();
    await expect(page.getByText('1 reviews')).toBeVisible();
    // the rating also shows on the catalogue card
    await page.goto('/products');
    await expect(
      page.locator(`a[href="/products/${productId}"]`).first().locator('[role="img"]'),
    ).toBeVisible();
  });

  test('can cancel a new order', async ({ page }) => {
    await useLanguage(page, 'en');
    await register(page);
    await openFirstProduct(page);
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await page.goto('/checkout');
    await page.locator('#co-city').selectOption('Cairo');
    await page.locator('#co-address').fill('5 Tahrir Square, downtown');
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page).toHaveURL(/\/orders\/\d+\?placed=1/);

    await page
      .getByRole('button', { name: /Cancel/ })
      .first()
      .click();
    // a confirmation may ask once more
    const confirm = page.getByRole('button', { name: /Yes|Confirm|Cancel order/ }).last();
    if (await confirm.isVisible()) await confirm.click();

    await expect(page.getByText('Cancelled').first()).toBeVisible();
  });
});
