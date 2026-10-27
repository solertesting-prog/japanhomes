import { expect, test } from '@playwright/test';
import { watchErrors } from './support';

test.describe('public site', () => {
  test('home renders with the DEMO banner and no runtime errors', async ({ page }) => {
    const errors = watchErrors(page);
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Japanese Real Estate');
    await expect(page.getByText('fictional DEMO data').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('sends security headers', async ({ request }) => {
    const res = await request.get('/');
    const h = res.headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['content-security-policy']).not.toContain('unsafe-eval');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-content-type-options']).toBe('nosniff');
  });

  test('marketplace lists the DEMO properties and opens a detail page', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/properties');
    const cards = page.locator('main a[href^="/properties/"]');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(6);

    await page.goto('/properties/tokyo-shibuya-apartment');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Shibuya Hikawa');
    await expect(page.getByText('DEMO').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('unknown property returns 404', async ({ page }) => {
    const res = await page.goto('/properties/does-not-exist');
    expect(res?.status()).toBe(404);
    await expect(page.getByText('Page not found')).toBeVisible();
  });

  test('language follows the locale cookie', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'jpt_locale', value: 'es', url: baseURL! }]);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Token a token');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });
});
