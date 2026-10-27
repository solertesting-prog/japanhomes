import { createHmac } from 'node:crypto';
import { type APIRequestContext, type BrowserContext, expect, type Page } from '@playwright/test';

export const PASSWORD = 'a long enough passphrase for e2e';

export const uniqueEmail = (tag: string) => `e2e.${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.test`;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of input.replace(/[\s=]/g, '').toUpperCase()) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** RFC 6238 code for `timeMs` — what an authenticator app would show. */
export function totp(secret: string, timeMs = Date.now()): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(timeMs / 30_000)));
  const h = createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1]! & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

/** Fails the test on uncaught page errors (a blank page usually starts here). */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Same-origin API calls with the context's cookies, echoing the CSRF cookie. */
export async function apiPost(request: APIRequestContext, context: BrowserContext, path: string, data: unknown = {}) {
  const csrf = (await context.cookies()).find((c) => c.name === 'jpt_csrf')?.value;
  const res = await request.post(`/api/v1${path}`, { data, headers: csrf ? { 'x-csrf-token': csrf } : {} });
  return res;
}

export async function latestToken(request: APIRequestContext, email: string, type: string): Promise<string> {
  let token: string | undefined;
  await expect
    .poll(async () => {
      const res = await request.get(`/api/v1/dev/outbox?email=${encodeURIComponent(email)}`);
      const items = ((await res.json()) as { items: Array<{ type: string; data: { token?: string } }> }).items;
      token = items.find((i) => i.type === type)?.data.token;
      return token;
    })
    .toBeTruthy();
  return token!;
}

/**
 * A verified, signed-in account with MFA on, created through the API (the UI
 * journey itself is covered in investor.spec.ts). Returns the TOTP secret.
 */
export async function apiAccount(page: Page, tag: string): Promise<{ email: string; secret: string }> {
  const { request } = page;
  const context = page.context();
  const email = uniqueEmail(tag);
  expect((await apiPost(request, context, '/auth/register', { email, password: PASSWORD, acceptTerms: true, acceptPrivacy: true })).status()).toBe(202);
  const token = await latestToken(request, email, 'auth.verify_email');
  expect((await apiPost(request, context, '/auth/verify-email', { token })).ok()).toBe(true);
  expect((await apiPost(request, context, '/auth/login', { email, password: PASSWORD })).status()).toBe(200);
  const setup = await (await apiPost(request, context, '/auth/mfa/setup')).json();
  expect((await apiPost(request, context, '/auth/mfa/enable', { code: totp(setup.secret) })).status()).toBe(204);
  return { email, secret: setup.secret as string };
}
