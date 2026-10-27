import { expect, test } from '@playwright/test';
import { apiAccount, apiPost, watchErrors } from './support';

test('investors are kept out of the back office', async ({ page }) => {
  await apiAccount(page, 'not-staff');
  await page.goto('/admin');
  await expect(page.getByText('This area is for platform staff.')).toBeVisible();
});

test('staff: overview, token deployment, worker and audit chain', async ({ page }) => {
  const errors = watchErrors(page);
  await apiAccount(page, 'staff');
  expect((await apiPost(page.request, page.context(), '/dev/roles/grant', { role: 'SUPER_ADMINISTRATOR' })).status()).toBe(204);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Back office' })).toBeVisible();
  await expect(page.getByText('Verified investors')).toBeVisible();

  // Tokens: deploy the first offering that has no contract yet, run the worker.
  await page.getByRole('navigation', { name: 'Back office' }).getByRole('link', { name: 'Tokens' }).click();
  await expect(page.getByText('Simulated chain')).toBeVisible();
  const deploy = page.getByRole('button', { name: 'Deploy (simulated)' }).first();
  if (await deploy.isVisible()) {
    const before = await page.getByRole('button', { name: 'Deploy (simulated)' }).count();
    await deploy.click();
    await expect(page.getByRole('button', { name: 'Deploy (simulated)' })).toHaveCount(before - 1);
  }
  await page.getByRole('button', { name: 'Run worker now' }).click();
  await expect(page.getByText(/Pass done:/)).toBeVisible();

  // Audit: the hash chain verifies end to end.
  await page.getByRole('navigation', { name: 'Back office' }).getByRole('link', { name: 'Audit log' }).click();
  await page.getByRole('button', { name: 'Verify hash chain' }).click();
  await expect(page.getByText(/Chain intact/)).toBeVisible();

  expect(errors).toEqual([]);
});
