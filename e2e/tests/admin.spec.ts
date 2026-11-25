import { Page, expect, test } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  API,
  HAS_ADMIN,
  PASSWORD,
  adminApi,
  apiCustomer,
  useLanguage,
} from './helpers';

test.skip(!HAS_ADMIN, 'set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run the dashboard tests');

/** A 1x1 PNG: a real image, so the upload check (it reads the file's first bytes) accepts it. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg==',
  'base64',
);

async function signIn(page: Page, email = ADMIN_EMAIL!, password = ADMIN_PASSWORD!) {
  await page.goto('/login');
  await page.locator('#admin-email').fill(email);
  await page.locator('#admin-password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function signInAsOwner(page: Page) {
  await useLanguage(page, 'en');
  await signIn(page);
  await expect(page.getByRole('navigation', { name: 'Dashboard' })).toBeVisible();
}

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

test.describe('sign in', () => {
  test('a wrong password is refused', async ({ page }) => {
    await useLanguage(page, 'en');
    await signIn(page, ADMIN_EMAIL!, 'Wrong-password-1');

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Dashboard' })).toHaveCount(0);
  });

  test('a customer account cannot use the dashboard', async ({ page, request }) => {
    const customer = await apiCustomer(request);
    await useLanguage(page, 'en');

    await signIn(page, customer.email, PASSWORD);

    await expect(page.getByText("This account is not the shop owner's.")).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Dashboard' })).toHaveCount(0);
  });

  test('visiting a page without signing in goes to the login, and the owner returns to it', async ({
    page,
  }) => {
    await useLanguage(page, 'en');
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login/);

    await page.locator('#admin-email').fill(ADMIN_EMAIL!);
    await page.locator('#admin-password').fill(ADMIN_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/orders/);
  });

  test('the owner stays signed in after a reload and can sign out', async ({ page }) => {
    await signInAsOwner(page);

    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Dashboard' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('dashboard', () => {
  test('every page of the dashboard opens', async ({ page, request }) => {
    const customer = await apiCustomer(request);
    await customer.order(); // so the dashboard has something to show
    await signInAsOwner(page);

    // the home page: the figures and the latest orders
    await expect(page.getByText('New orders waiting')).toBeVisible();
    await expect(page.getByText('Orders by status')).toBeVisible();
    await expect(page.getByText('Latest orders')).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'Dashboard' });
    for (const [link, heading] of [
      ['Orders', 'Orders'],
      ['Products', 'Products'],
      ['Categories', 'Categories'],
      ['Reviews', 'Reviews'],
      ['Messages', 'Messages'],
      ['Team', 'Team'],
      ['Home', 'Home'],
    ]) {
      await nav.getByRole('link', { name: new RegExp(`^${link}`) }).click();
      await expect(
        page.getByRole('heading', { level: 1, name: heading, exact: true }),
        `the ${link} page`,
      ).toBeVisible();
      await expect(page.getByText('Something went wrong'), `the ${link} page loaded`).toHaveCount(
        0,
      );
    }
  });

  test('switches to Arabic (right to left) and back', async ({ page }) => {
    await signInAsOwner(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    await page.getByRole('button', { name: /العربية/ }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('navigation').getByRole('link').first()).toContainText(/[؀-ۿ]/);
  });
});

test.describe('orders', () => {
  test('the owner finds an order, works it through every step, adds tracking and delivers it', async ({
    page,
    request,
  }) => {
    const customer = await apiCustomer(request);
    const buyer = `Order ${unique()}`;
    const { orderId } = await customer.order(buyer);
    await signInAsOwner(page);

    // ----- find it by the customer's name
    await page
      .getByRole('navigation', { name: 'Dashboard' })
      .getByRole('link', { name: /^Orders/ })
      .click();
    const search = page.getByPlaceholder('Search by customer name, phone or order number');
    await search.fill(buyer);
    await search.press('Enter');
    await page.locator(`a[href="/orders/${orderId}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`));
    await expect(page.getByText(buyer).first()).toBeVisible();

    // ----- the steps, one after the other
    for (const action of ['Confirm order', 'Start preparing', 'Mark as shipped']) {
      await page.getByRole('button', { name: action }).click();
      // the button goes away once the order has moved on (a toast from the step before may still be showing)
      await expect(page.getByRole('button', { name: action })).toHaveCount(0);
    }

    // ----- shipping details, and the WhatsApp message that carries them
    const number = `E2E-${unique()}`;
    await page.getByLabel('Courier').fill('Bosta');
    await page.getByLabel('Tracking number').fill(number);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    // saved: the details are shown, not editable, until Edit is pressed
    await expect(page.getByLabel('Courier')).toHaveCount(0);
    await expect(page.getByLabel('Tracking number')).toHaveCount(0);
    await expect(page.getByText(number)).toBeVisible();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByLabel('Tracking number')).toHaveValue(number);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByLabel('Tracking number')).toHaveCount(0);

    const whatsapp = page.getByRole('link', { name: 'Send tracking on WhatsApp' });
    await expect(whatsapp).toBeVisible();
    const href = (await whatsapp.getAttribute('href'))!;
    expect(href).toContain('https://wa.me/20');
    expect(decodeURIComponent(href)).toContain(number);

    // the customer sees it
    let order = await customer.getOrder(orderId);
    expect(order.status).toBe('Shipped');
    expect(order.trackingNumber).toBe(number);
    expect(order.trackingCompany).toBe('Bosta');

    // ----- delivered
    await page.getByRole('button', { name: 'Mark as delivered' }).click();
    await expect(page.getByRole('button', { name: 'Mark as delivered' })).toHaveCount(0);
    order = await customer.getOrder(orderId);
    expect(order.status).toBe('Delivered');
    // a delivered order has no further action
    await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
  });

  test('the owner can cancel an order, after a confirmation, and the stock comes back', async ({
    page,
    request,
  }) => {
    const customer = await apiCustomer(request);
    const { orderId, productId } = await customer.order();
    const stockBefore = (await (await request.get(`${API}/products/${productId}`)).json())
      .stockQuantity;
    await signInAsOwner(page);

    await page.goto(`/orders/${orderId}`);
    await page.getByRole('button', { name: 'Cancel order' }).click();
    await expect(page.getByText('Cancel this order? The items go back to stock.')).toBeVisible();
    await page.getByRole('button', { name: 'Keep it' }).click();
    expect((await customer.getOrder(orderId)).status).toBe('Placed');

    await page.getByRole('button', { name: 'Cancel order' }).click();
    await page.getByRole('button', { name: 'Yes, cancel' }).click();
    await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);

    expect((await customer.getOrder(orderId)).status).toBe('Cancelled');
    const stockAfter = (await (await request.get(`${API}/products/${productId}`)).json())
      .stockQuantity;
    expect(stockAfter).toBe(stockBefore + 1);
  });

  test('filters the orders list by status and by search', async ({ page, request }) => {
    const customer = await apiCustomer(request);
    const buyer = `Filter ${unique()}`;
    const { orderId } = await customer.order(buyer);
    await signInAsOwner(page);
    await page.goto('/orders');

    const search = page.getByPlaceholder('Search by customer name, phone or order number');
    await search.fill(buyer);
    await search.press('Enter');
    await expect(page).toHaveURL(/search=/);
    await expect(page.locator(`a[href="/orders/${orderId}"]`).first()).toBeVisible();

    await search.fill(`nobody-${unique()}`);
    await search.press('Enter');
    await expect(page.getByText('No orders here.')).toBeVisible();
  });
});

test.describe('products', () => {
  test('the owner adds a product with a photo and English name, then hides it', async ({
    page,
    request,
  }) => {
    const id = unique();
    const arabic = `منتج اختبار ${id}`;
    const english = `E2E Test Product ${id}`;
    await signInAsOwner(page);

    // ----- create
    await page.goto('/products/new');
    await page.getByLabel('Product name', { exact: true }).fill(arabic);
    await page.getByLabel('Product name (English)').fill(english);
    await page.getByLabel('Category').selectOption({ index: 1 });
    await page.getByLabel('Price (EGP)').fill('333');
    await page.getByLabel('Quantity in stock').fill('7');
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('img[src*="/uploads/"]').first()).toBeAttached();
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // ----- it is in the owner's list
    await expect(page).toHaveURL(/\/products$/);
    await page.getByPlaceholder('Search by name or code').fill(id);
    const row = page.locator('tr', { hasText: arabic });
    await expect(row).toBeVisible();

    // ----- and in the shop, in both languages
    const shop = await (
      await request.get(`${API}/products?search=${encodeURIComponent(id)}`)
    ).json();
    expect(shop.totalCount).toBe(1);
    expect(shop.items[0].name).toBe(arabic);
    expect(shop.items[0].nameEn).toBe(english);
    expect(shop.items[0].imageUrl).toContain('/uploads/');
    expect(shop.items[0].price).toBe(333);

    // ----- edit the price
    await row.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/products\/\d+$/);
    await expect(page.getByLabel('Price (EGP)')).toHaveValue('333');
    await page.getByLabel('Price (EGP)').fill('350');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page).toHaveURL(/\/products$/);
    const edited = await (
      await request.get(`${API}/products?search=${encodeURIComponent(id)}`)
    ).json();
    expect(edited.items[0].price).toBe(350);

    // ----- hide it: it disappears from the shop
    await page.getByPlaceholder('Search by name or code').fill(id);
    await page.locator('tr', { hasText: arabic }).getByRole('button', { name: 'Hide' }).click();
    await page.getByRole('button', { name: 'Sure? Hide it' }).click();
    await expect(page.getByText('The product is now hidden from the shop.').first()).toBeVisible();
    const hidden = await (
      await request.get(`${API}/products?search=${encodeURIComponent(id)}`)
    ).json();
    expect(hidden.totalCount).toBe(0);
  });

  test('the form refuses a missing name, category or price', async ({ page }) => {
    await signInAsOwner(page);
    await page.goto('/products/new');

    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page).toHaveURL(/\/products\/new$/);
    await expect(page.getByRole('alert').first()).toBeVisible();
  });

  test('a file that is not an image is refused', async ({ page }) => {
    await signInAsOwner(page);
    await page.goto('/products/new');

    await page.locator('input[type="file"]').setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('<script>alert(1)</script> this is not a png at all'),
    });

    await expect(page.getByText('Could not upload the photo.')).toBeVisible();
  });
});

test.describe('categories, reviews and team', () => {
  test('the owner renames a category in English and the shop shows it', async ({
    page,
    request,
  }) => {
    await signInAsOwner(page);
    await page.goto('/categories');

    const english = page.getByLabel('English name').first();
    const original = await english.inputValue();
    const renamed = `E2E ${unique()}`;
    try {
      await english.fill(renamed);
      await page.getByRole('button', { name: 'Save', exact: true }).first().click();
      await expect(page.getByText('Saved.').first()).toBeVisible();

      const categories = await (await request.get(`${API}/categories`)).json();
      expect(categories.some((c: { nameEn: string | null }) => c.nameEn === renamed)).toBe(true);
    } finally {
      await english.fill(original);
      await page.getByRole('button', { name: 'Save', exact: true }).first().click();
      await expect(page.getByText('Saved.').first()).toBeVisible();
    }
  });

  test('the owner removes a customer review', async ({ page, request }) => {
    const customer = await apiCustomer(request);
    const { orderId, productId } = await customer.order();
    const admin = await adminApi(request);
    for (const status of ['Confirmed', 'Preparing', 'Shipped', 'Delivered'])
      await admin.setStatus(orderId, status);
    const comment = `Review to remove ${unique()}`;
    await customer.review(productId, 4, comment);

    await signInAsOwner(page);
    await page.goto('/reviews');
    const item = page.locator('li', { hasText: comment });
    await expect(item).toBeVisible();
    await item.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText(comment)).toHaveCount(0);
    const reviews = await (await request.get(`${API}/products/${productId}/reviews`)).json();
    expect(reviews.items.some((r: { comment: string }) => r.comment === comment)).toBe(false);
  });

  test('the owner adds another admin, who can sign in, and then deactivates the account', async ({
    page,
    request,
  }) => {
    const email = `e2e-team-${unique()}@example.com`;
    await signInAsOwner(page);
    await page.goto('/team');

    // ----- add
    await page.getByRole('button', { name: 'Add admin' }).click();
    await page.locator('#new-name').fill('E2E Team Member');
    await page.locator('#new-email').fill(email);
    await page.locator('#new-password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Admin added').first()).toBeVisible();
    const member = page.locator('li', { hasText: email });
    await expect(member).toBeVisible();

    const login = () =>
      request.post(`${API}/auth/login`, {
        data: { email, password: PASSWORD },
        headers: { 'X-Client-App': 'admin' },
      });
    expect((await login()).status()).toBe(200);

    // ----- deactivate: the account can no longer sign in
    await member.getByRole('button', { name: 'Deactivate' }).click();
    await expect(page.getByText('Account deactivated').first()).toBeVisible();
    await expect(member.getByText('Inactive')).toBeVisible();
    expect((await login()).status()).toBe(401);

    // ----- the owner cannot lock themselves out
    const own = page.locator('li', { hasText: ADMIN_EMAIL! });
    await expect(own.getByText('You')).toBeVisible();
    await expect(own.getByRole('button', { name: 'Deactivate' })).toHaveCount(0);
  });

  test('a duplicate email is refused when adding an admin', async ({ page }) => {
    await signInAsOwner(page);
    await page.goto('/team');

    await page.getByRole('button', { name: 'Add admin' }).click();
    await page.locator('#new-name').fill('Duplicate');
    await page.locator('#new-email').fill(ADMIN_EMAIL!);
    await page.locator('#new-password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('This email is used by another account.')).toBeVisible();
  });
});

test.describe('InstaPay payments', () => {
  test('the owner rejects a receipt with a reason, the customer sends another, and the owner confirms', async ({
    page,
    request,
  }) => {
    const shop = await (await request.get(`${API}/shop`)).json();
    test.skip(!shop.instaPay, 'the shop has no InstaPay address (Shop__InstaPay__Handle)');
    const customer = await apiCustomer(request);
    const orderId = await customer.orderWithInstaPay();
    await signInAsOwner(page);

    await page.goto(`/orders/${orderId}`);
    await expect(page.getByRole('heading', { name: 'InstaPay payment' })).toBeVisible();
    await expect(page.getByText('To review').first()).toBeVisible();
    await expect(page.getByText('IP-ADMIN-1')).toBeVisible();
    // the screenshot is shown (it is fetched with the owner's sign-in), and the order cannot move on yet
    await expect(page.locator('app-receipt-image img')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm order' })).toHaveCount(0);

    // reject, with a reason the customer will read
    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    await page.getByLabel('Why?').fill('The amount is not the order total');
    await page.getByRole('button', { name: 'Reject and notify' }).click();
    await expect(page.getByText('Payment reviewed.').first()).toBeVisible();
    expect((await customer.getOrder(orderId)).paymentStatus).toBe('Rejected');
    expect((await customer.getOrder(orderId)).paymentNote).toBe(
      'The amount is not the order total',
    );

    // the customer uploads another receipt: it is waiting for review again
    await customer.replaceReceipt(orderId);
    await page.reload();
    await page.getByRole('button', { name: 'Confirm payment' }).click();
    await expect(page.getByText('Payment reviewed.').first()).toBeVisible();
    expect((await customer.getOrder(orderId)).paymentStatus).toBe('Confirmed');

    // now the order can move on
    await expect(page.getByRole('button', { name: 'Confirm order' })).toBeVisible();
  });
});
