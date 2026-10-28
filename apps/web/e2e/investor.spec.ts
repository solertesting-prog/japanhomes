import { expect, test } from '@playwright/test';
import { PASSWORD, totp, uniqueEmail, watchErrors } from './support';

/**
 * The whole investor journey through the UI: sign-up → email link → sign-in →
 * two-step verification → identity verification → investment → dashboard →
 * sign-in again with a TOTP code.
 */
test('investor journey from sign-up to dashboard', async ({ page }) => {
  test.slow();
  const errors = watchErrors(page);
  const email = uniqueEmail('journey');

  // Sign up
  await page.goto('/sign-up');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  const boxes = page.getByRole('checkbox');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  // The development outbox shows the confirmation link
  await page.getByRole('link', { name: 'Open link' }).click();
  await expect(page.getByText('Your email is confirmed')).toBeVisible();
  await page.getByRole('link', { name: 'Go to sign in' }).click();

  // Sign in
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);

  // Two-step verification
  await page.goto('/account');
  await page.getByRole('button', { name: 'Set up two-step verification' }).click();
  const secret = (await page.locator('code').first().innerText()).replace(/\s/g, '');
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
  await page.getByLabel('Enter the 6-digit code it shows').fill(totp(secret));
  await page.getByRole('button', { name: 'Turn on' }).click();
  await expect(page.getByText('Two-step verification is on')).toBeVisible();

  // Identity verification (mock provider)
  await page.goto('/verify');
  await page.getByLabel('Country of residence').selectOption('JP');
  await page.getByLabel('Nationality').selectOption('JP');
  await page.getByRole('button', { name: 'Start verification' }).click();
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByText('Your identity is verified.')).toBeVisible();

  // Invest the minimum in a DEMO offering, simulated payment
  await page.goto('/invest/tokyo-shibuya-apartment');
  await expect(page.getByText('Simulation: DEMO offering')).toBeVisible();
  await page.getByRole('button', { name: 'Reserve tokens' }).click();
  const docs = page.getByRole('checkbox');
  await expect(docs.first()).toBeVisible();
  for (let i = 0; i < (await docs.count()); i++) await docs.nth(i).check();
  await page.getByRole('button', { name: 'Accept and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Payment instructions' })).toBeVisible();
  await page.getByRole('button', { name: 'Payment received' }).click();
  await expect(page.getByText('Investment confirmed')).toBeVisible();

  await page.getByRole('link', { name: 'Go to your dashboard' }).click();
  await expect(page.getByRole('link', { name: 'Shibuya Hikawa 1LDK' })).toBeVisible();
  await expect(page.getByText(/awaiting issuance/)).toBeVisible();

  // Sign out and back in: the second factor is required (next time step, so
  // the code used to turn MFA on is not replayed).
  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out' }).click();
  // Sign-out navigates home; wait for it so it cannot override the next navigation.
  await page.waitForURL((url) => url.pathname === '/');
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Authentication code').fill(totp(secret, Date.now() + 30_000));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
  await page.goto('/dashboard');
  await expect(page.getByRole('link', { name: 'Shibuya Hikawa 1LDK' })).toBeVisible();

  expect(errors).toEqual([]);
});
