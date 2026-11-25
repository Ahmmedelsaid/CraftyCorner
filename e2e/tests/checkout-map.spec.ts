import { Page, expect, test } from '@playwright/test';
import { openFirstProduct, register, useLanguage } from './helpers';

/**
 * The delivery map in the checkout. Map tiles and the address lookup go to outside services
 * (OpenStreetMap and Nominatim), so the tests answer those requests themselves: they stay fast,
 * and do not depend on, or hammer, a public server.
 */
async function stubMapServices(page: Page, lookup: 'ok' | 'fails' = 'ok') {
  await page.route('**/tile.openstreetmap.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) }),
  );
  await page.route('**/geocode/reverse**', (route) =>
    lookup === 'ok'
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ address: '12 Nile Street, Dokki', state: 'Giza Governorate' }),
        })
      : route.fulfill({ status: 502, contentType: 'application/json', body: '{}' }),
  );
}

async function goToCheckout(page: Page) {
  await register(page);
  await openFirstProduct(page);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('link', { name: 'Shopping cart' })).toContainText('1');
  await page.goto('/checkout');
  await expect(page.locator('.leaflet-container')).toBeVisible();
}

test.describe('delivery map', () => {
  test.beforeEach(async ({ page }) => {
    await useLanguage(page, 'en');
  });

  test('tapping the map drops a pin, fills in the address, and the order carries the pin', async ({
    page,
  }) => {
    await stubMapServices(page);
    await goToCheckout(page);

    // ----- tap the map
    await expect(
      page.getByText('Tap the map to drop a pin on your exact location (optional).'),
    ).toBeVisible();
    await page.locator('.leaflet-container').click();

    await expect(page.getByText('Pin saved. Drag it to adjust.')).toBeVisible();
    await expect(page.locator('.pin-marker, .leaflet-marker-icon').first()).toBeVisible();
    // the governorate and the street come from the pin
    await expect(page.locator('#co-city')).toHaveValue('Giza');
    await expect(page.locator('#co-address')).toHaveValue(/12 Nile Street/);

    // ----- the order is sent with the pin
    const request = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().endsWith('/orders'),
    );
    await page.getByRole('button', { name: 'Place order' }).click();
    const body = (await request).postDataJSON();
    expect(body.latitude).toEqual(expect.any(Number));
    expect(body.longitude).toEqual(expect.any(Number));
    expect(body.city).toBe('Giza');

    // ----- and the order page offers the pin on a map
    await expect(page).toHaveURL(/\/orders\/\d+\?placed=1/);
    await expect(page.getByRole('link', { name: 'View delivery pin on the map' })).toHaveAttribute(
      'href',
      /openstreetmap\.org\/\?mlat=/,
    );
  });

  test('the pin can be removed and the order is placed without it', async ({ page }) => {
    await stubMapServices(page);
    await goToCheckout(page);
    await page.locator('.leaflet-container').click();
    await expect(page.getByText('Pin saved. Drag it to adjust.')).toBeVisible();

    await page.getByRole('button', { name: 'Remove pin' }).click();
    await expect(
      page.getByText('Tap the map to drop a pin on your exact location (optional).'),
    ).toBeVisible();

    const request = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().endsWith('/orders'),
    );
    await page.getByRole('button', { name: 'Place order' }).click();
    const body = (await request).postDataJSON();
    expect(body.latitude).toBeNull();
    expect(body.longitude).toBeNull();
    await expect(page).toHaveURL(/\/orders\/\d+\?placed=1/);
  });

  test('when the address lookup fails the customer is asked to type it, and can still order', async ({
    page,
  }) => {
    await stubMapServices(page, 'fails');
    await goToCheckout(page);

    await page.locator('.leaflet-container').click();
    await expect(
      page.getByText('We could not read the address from the pin. Please type it in.'),
    ).toBeVisible();

    await page.locator('#co-city').selectOption('Qalyubia');
    await page.locator('#co-address').fill('7 Shubra Road, Qalyubia');
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page).toHaveURL(/\/orders\/\d+\?placed=1/);
  });

  test('an address the customer typed is not overwritten by the pin', async ({ page }) => {
    await stubMapServices(page);
    await goToCheckout(page);
    await page.locator('#co-address').fill('My own address, building 5');

    await page.locator('.leaflet-container').click();
    await expect(page.getByText('Pin saved. Drag it to adjust.')).toBeVisible();

    await expect(page.locator('#co-address')).toHaveValue('My own address, building 5');
    await expect(page.locator('#co-city')).toHaveValue('Giza');
  });

  test('"Use my location" explains what to do when the location is blocked', async ({
    page,
    context,
  }) => {
    await stubMapServices(page);
    await context.clearPermissions();
    await goToCheckout(page);

    await page.getByRole('button', { name: 'Use my location' }).click();

    await expect(
      page.getByText(
        /Location access is blocked\. Tap the map instead\.|We could not get your location\. Tap the map instead\./,
      ),
    ).toBeVisible();
  });
});
