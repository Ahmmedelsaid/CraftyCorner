import { expect, test } from '@playwright/test';
import { expectNoSideScroll, openFirstProduct, register, useLanguage } from './helpers';

/** The shop on a phone (Pixel 5 screen, touch): nothing sticks out sideways, and the main path works. */

for (const lang of ['en', 'ar'] as const) {
  test.describe(`on a phone, in ${lang === 'en' ? 'English' : 'Arabic'}`, () => {
    test.beforeEach(async ({ page }) => {
      await useLanguage(page, lang);
    });

    test('the public pages fit the screen', async ({ page }) => {
      for (const path of ['/', '/products', '/about', '/contact', '/login', '/register']) {
        await page.goto(path);
        await expect(page.locator('main, #main').first()).toBeVisible();
        await expectNoSideScroll(page, `${path} (${lang})`);
      }
      const productId = await openFirstProduct(page);
      expect(productId).toBeGreaterThan(0);
      await expectNoSideScroll(page, `a product page (${lang})`);
    });

    test('the pages of a signed-in customer fit the screen', async ({ page }) => {
      await register(page);
      await openFirstProduct(page);
      await page.getByRole('button', { name: lang === 'en' ? 'Add to cart' : /أضف/ }).click();

      for (const path of ['/cart', '/checkout', '/account', '/orders', '/wishlist']) {
        await page.goto(path);
        await expect(page.locator('main, #main').first()).toBeVisible();
        await expectNoSideScroll(page, `${path} (${lang})`);
      }
    });
  });
}

test.describe('on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await useLanguage(page, 'en');
  });

  test('the layout is the phone layout, with the direction following the language', async ({
    page,
  }) => {
    await page.goto('/');
    expect(page.viewportSize()!.width).toBeLessThan(500);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    await useLanguage(page, 'ar');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expectNoSideScroll(page, 'the home page in Arabic');
  });

  test('buttons and links are big enough to tap', async ({ page }) => {
    await openFirstProduct(page);

    const add = page.getByRole('button', { name: 'Add to cart' });
    const box = (await add.boundingBox())!;
    expect(box.height, 'the add-to-cart button height').toBeGreaterThanOrEqual(40);
    expect(box.width, 'the add-to-cart button width').toBeGreaterThanOrEqual(40);
  });

  test('a customer can order a product with taps only', async ({ page }) => {
    await register(page);
    await openFirstProduct(page);
    await page.getByRole('button', { name: 'Add to cart' }).tap();
    await expect(page.getByRole('link', { name: 'Shopping cart' })).toContainText('1');

    await page.getByRole('link', { name: 'Shopping cart' }).tap();
    await page.getByRole('link', { name: 'Checkout' }).tap();
    await expect(page).toHaveURL(/\/checkout/);

    await page.locator('#co-city').selectOption('Giza');
    await page.locator('#co-address').fill('12 Nile Street, Dokki, building 3');
    await page.getByRole('button', { name: 'Place order' }).tap();

    await expect(page).toHaveURL(/\/orders\/\d+\?placed=1/);
    await expect(
      page.getByRole('heading', { name: 'Thank you! Your order is placed.' }),
    ).toBeVisible();
    await expectNoSideScroll(page, 'the order confirmation');
  });
});
