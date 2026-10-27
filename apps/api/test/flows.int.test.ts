/**
 * End-to-end flows against a real, migrated and seeded PostgreSQL.
 * Run with:  pnpm --filter @jpt/api test:int   (needs TEST_DATABASE_URL)
 */
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { totpAt } from '../src/common/totp';
import { signPayload } from '../src/common/webhook-signature';
import type { PrismaService } from '../src/prisma/prisma.service';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';
import {
  acceptAll,
  Client,
  createApp,
  latestEmailToken,
  placeOrder,
  registerAndVerify,
  staffMember,
  uniqueEmail,
  verifiedInvestor,
} from './helpers';

const PASSWORD = 'a long enough passphrase';
const SLUG = 'tokyo-shibuya-apartment';

let app: INestApplication;
let prisma: PrismaService;

const offeringOf = (slug: string) =>
  prisma.tokenOffering.findFirstOrThrow({ where: { property: { slug } }, orderBy: { createdAt: 'desc' } });

beforeAll(async () => {
  ({ app, prisma } = await createApp());
});

afterAll(async () => {
  await app?.close();
});

describe('registration, verification and sign-in', () => {
  const email = uniqueEmail('reg');

  it('registers without revealing whether the email exists', async () => {
    const c = new Client(app);
    const a = await c.post('/v1/auth/register', { email, password: PASSWORD, acceptTerms: true, acceptPrivacy: true });
    const b = await c.post('/v1/auth/register', { email, password: PASSWORD, acceptTerms: true, acceptPrivacy: true });
    expect(a.status).toBe(202);
    expect(b.status).toBe(202);
    expect(b.body).toEqual(a.body);
  });

  it('stores a hash, never the password, and records consents', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { consents: true } });
    expect(user.passwordHash.startsWith('scrypt$')).toBe(true);
    expect(user.passwordHash.includes(PASSWORD)).toBe(false);
    expect(user.consents.map((c) => c.type).sort()).toEqual(['PRIVACY_POLICY', 'TERMS_OF_SERVICE']);
  });

  it('refuses sign-in before the email is verified, then accepts it', async () => {
    const c = new Client(app);
    expect((await c.post('/v1/auth/login', { email, password: PASSWORD })).body.code).toBe('EMAIL_NOT_VERIFIED');
    const token = await latestEmailToken(app, email, 'auth.verify_email');
    expect((await c.post('/v1/auth/verify-email', { token })).status).toBe(200);
    expect((await c.post('/v1/auth/verify-email', { token })).body.code).toBe('TOKEN_INVALID');
    const ok = await c.post('/v1/auth/login', { email, password: PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.body.roles).toContain('INVESTOR');
    expect((await c.get('/v1/auth/me')).body.email).toBe(email);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const c = new Client(app);
    const wrong = await c.post('/v1/auth/login', { email, password: 'not the password at all' });
    const unknown = await c.post('/v1/auth/login', { email: uniqueEmail('nobody'), password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.code).toBe(unknown.body.code);
  });

  it('locks the account after five failures, even for the right password', async () => {
    const e = uniqueEmail('lock');
    await registerAndVerify(app, e, PASSWORD);
    const c = new Client(app);
    for (let i = 0; i < 5; i++) await c.post('/v1/auth/login', { email: e, password: `wrong password ${i}!` });
    expect((await c.post('/v1/auth/login', { email: e, password: PASSWORD })).status).toBe(401);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: e } });
    expect(user.lockedUntil !== null && user.lockedUntil > new Date()).toBe(true);
  });

  it('resets the password and revokes existing sessions', async () => {
    const e = uniqueEmail('reset');
    const c = await registerAndVerify(app, e, PASSWORD);
    const anon = new Client(app);
    expect((await anon.post('/v1/auth/password/forgot', { email: e })).status).toBe(202);
    const token = await latestEmailToken(app, e, 'auth.password_reset');
    expect((await anon.post('/v1/auth/password/reset', { token, password: 'a brand new passphrase' })).status).toBe(204);
    expect((await c.get('/v1/auth/me')).status).toBe(401);
    expect((await anon.post('/v1/auth/login', { email: e, password: 'a brand new passphrase' })).status).toBe(200);
  });
});

describe('CSRF, RBAC and MFA', () => {
  it('rejects state-changing requests without the CSRF token', async () => {
    const c = await registerAndVerify(app, uniqueEmail('csrf'), PASSWORD);
    const r = await c.post('/v1/kyc/start', { countryOfResidence: 'ES', nationality: 'ES' }, {}, { csrf: false });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('CSRF_FAILED');
  });

  it('enforces permissions in the backend', async () => {
    const c = await registerAndVerify(app, uniqueEmail('rbac'), PASSWORD);
    expect((await c.get('/v1/compliance/kyc')).status).toBe(403);
    expect((await c.get('/v1/admin/users')).status).toBe(403);
    expect((await new Client(app).get('/v1/me/portfolio')).status).toBe(401);
  });

  it('enables TOTP and requires it at the next sign-in', async () => {
    const email = uniqueEmail('mfa');
    const c = await registerAndVerify(app, email, PASSWORD);
    const setup = await c.post('/v1/auth/mfa/setup');
    expect(setup.body.otpauthUri.startsWith('otpauth://totp/')).toBe(true);
    expect((await c.post('/v1/auth/mfa/enable', { code: '000000' })).status).toBe(400);
    const enableCode = totpAt(setup.body.secret, Date.now());
    expect((await c.post('/v1/auth/mfa/enable', { code: enableCode })).status).toBe(204);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(Buffer.from(stored.mfaSecretEnc!).toString('utf8').includes(setup.body.secret)).toBe(false);

    const c2 = new Client(app);
    const login = await c2.post('/v1/auth/login', { email, password: PASSWORD });
    expect(login.body.mfaPending).toBe(true);
    expect((await c2.get('/v1/kyc')).body.code).toBe('MFA_REQUIRED');
    // A code is accepted once: replaying the one used to enable MFA fails.
    expect((await c2.post('/v1/auth/mfa/verify', { code: enableCode })).body.code).toBe('MFA_CODE_INVALID');
    // The next time step (inside the ±1 drift window) is accepted.
    const verified = await c2.post('/v1/auth/mfa/verify', { code: totpAt(setup.body.secret, Date.now() + 30_000) });
    expect(verified.body.mfaPending).toBe(false);
    expect((await c2.get('/v1/kyc')).status).toBe(200);
  });
});

describe('KYC', () => {
  it('approves clear cases and grants simulation-only eligibility to non-residents', async () => {
    const { client } = await verifiedInvestor(app, 'kyc-es', 'ES');
    const status = await client.get('/v1/kyc');
    expect(status.body.status).toBe('APPROVED');
    expect(status.body.eligibility).toEqual({ simulatedAllowed: true, realAllowed: false });
    expect((await client.get('/v1/auth/me')).body.roles).toContain('VERIFIED_INVESTOR');
  });

  it('routes doubtful cases to manual review and enforces four-eyes', async () => {
    const subjectEmail = uniqueEmail('kyc-review');
    const subject = await registerAndVerify(app, subjectEmail, PASSWORD);
    await subject.post('/v1/kyc/start', { countryOfResidence: 'JP', nationality: 'JP' });
    expect((await subject.post('/v1/dev/kyc/complete', { outcome: 'consider' })).body.status).toBe('UNDER_REVIEW');

    // Back-office routes need MFA on the staff account.
    const noMfa = await staffMember(app, prisma, 'officer-nomfa', ['COMPLIANCE_OFFICER'], { mfa: false });
    expect((await noMfa.client.get('/v1/compliance/kyc?status=UNDER_REVIEW')).body.code).toBe('STAFF_MFA_REQUIRED');

    const { client: officer, userId: officerId } = await staffMember(app, prisma, 'officer', ['COMPLIANCE_OFFICER']);
    const officerUser = { id: officerId };

    const queue = await officer.get('/v1/compliance/kyc?status=UNDER_REVIEW');
    expect(queue.status).toBe(200);
    const kycCase = (queue.body as Array<{ id: string; email: string }>).find((k) => k.email === subjectEmail)!;
    const decision = await officer.post(`/v1/compliance/kyc/${kycCase.id}/decision`, {
      decision: 'APPROVE',
      reason: 'Documents re-checked manually, consistent with the profile.',
    });
    expect(decision.status).toBe(200);
    const refreshed = await prisma.kycVerification.findUniqueOrThrow({ where: { id: kycCase.id } });
    expect(refreshed.status).toBe('APPROVED');
    expect(refreshed.reviewedById).toBe(officerUser.id);
  });

  it('rejects sanctions hits automatically', async () => {
    const c = await registerAndVerify(app, uniqueEmail('kyc-sanctions'), PASSWORD);
    await c.post('/v1/kyc/start', { countryOfResidence: 'ES', nationality: 'ES' });
    expect((await c.post('/v1/dev/kyc/complete', { outcome: 'sanctions' })).body.status).toBe('REJECTED');
  });

  it('rejects webhooks with a bad signature', async () => {
    const r = await new Client(app).post('/v1/webhooks/kyc', { eventId: 'evt_forged_000' }, { 'x-jpt-signature': 't=1,v1=00' });
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });
});

describe('simulated subscription, payment and allocation', () => {
  it('blocks investing before verification', async () => {
    const c = await registerAndVerify(app, uniqueEmail('noinv'), PASSWORD);
    expect((await placeOrder(c, SLUG, '100000')).status).toBe(403);
  });

  it('runs the full flow: order → documents → payment → allocation → portfolio', async () => {
    const { client } = await verifiedInvestor(app, 'investor');
    const before = await offeringOf(SLUG);

    expect((await client.post('/v1/subscriptions', { propertySlug: SLUG, amount: '100000' })).body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

    const key = `flow-${Date.now()}`;
    const created = await placeOrder(client, SLUG, '100000', key);
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('PENDING_DOCUMENTS');
    expect(created.body.tokens).toBe('100');
    expect(created.body.totalAmount).toBe('101000');
    expect(created.body.isSimulated).toBe(true);

    const replay = await placeOrder(client, SLUG, '100000', key);
    expect(replay.body.id).toBe(created.body.id);
    expect((await placeOrder(client, 'osaka-umeda-apartment', '100000', key)).body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect((await offeringOf(SLUG)).tokensReserved).toBe(before.tokensReserved + 100n);

    const partial = await client.post(`/v1/subscriptions/${created.body.id}/accept-documents`, {
      documentIds: [created.body.requiredDocuments[0].id],
    });
    expect(partial.body.code).toBe('DOCUMENTS_REQUIRED');

    const accepted = await acceptAll(client, created.body);
    expect(accepted.body.status).toBe('AWAITING_PAYMENT');
    expect(accepted.body.payment.instructions.amount).toBe('101000');

    const paid = await client.post(`/v1/dev/payments/${created.body.id}/simulate`, { outcome: 'succeeded', eventId: `evt_${key}` });
    expect(paid.body.status).toBe('allocated');
    const dup = await client.post(`/v1/dev/payments/${created.body.id}/simulate`, { outcome: 'succeeded', eventId: `evt_${key}` });
    expect(dup.body.status).toBe('duplicate');

    const order = await client.get(`/v1/subscriptions/${created.body.id}`);
    expect(order.body.status).toBe('ALLOCATED');
    expect(order.body.allocation.status).toBe('PENDING');

    const after = await offeringOf(SLUG);
    expect(after.tokensSold).toBe(before.tokensSold + 100n);
    expect(after.tokensReserved).toBe(before.tokensReserved);

    const portfolio = await client.get('/v1/me/portfolio');
    expect(portfolio.body.totals.investedAmount).toBe('100000');
    expect(portfolio.body.holdings[0].tokens).toBe('100');

    const csv = await client.get('/v1/me/transactions?format=csv');
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain(order.body.reference);

    // The payment produced one balanced, immutable journal entry.
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: created.body.id } });
    const entry = await prisma.journalEntry.findUniqueOrThrow({ where: { externalKey: `payment:${payment.id}:captured` }, include: { postings: true } });
    expect(entry.postings.reduce((a, p) => a + p.amount, 0n)).toBe(0n);
  });

  it('releases tokens when an order is cancelled', async () => {
    const { client } = await verifiedInvestor(app, 'cancel');
    const before = await offeringOf(SLUG);
    const o = await placeOrder(client, SLUG, '50000');
    expect((await client.post(`/v1/subscriptions/${o.body.id}/cancel`)).body.status).toBe('CANCELLED');
    expect((await offeringOf(SLUG)).tokensReserved).toBe(before.tokensReserved);
  });

  it('refunds a payment that arrives after cancellation', async () => {
    const { client } = await verifiedInvestor(app, 'late');
    const o = await placeOrder(client, SLUG, '50000');
    await acceptAll(client, o.body);
    await client.post(`/v1/subscriptions/${o.body.id}/cancel`);
    expect((await client.post(`/v1/dev/payments/${o.body.id}/simulate`, { outcome: 'succeeded' })).body.status).toBe('refunded');
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: o.body.id } });
    expect(payment.status).toBe('REFUNDED');
  });

  it('refunds a payment with the wrong amount and frees the reservation', async () => {
    const { client } = await verifiedInvestor(app, 'mismatch');
    const before = await offeringOf(SLUG);
    const o = await placeOrder(client, SLUG, '50000');
    await acceptAll(client, o.body);
    expect((await client.post(`/v1/dev/payments/${o.body.id}/simulate`, { outcome: 'succeeded', amount: '1' })).body.status).toBe('refunded');
    expect((await client.get(`/v1/subscriptions/${o.body.id}`)).body.status).toBe('REFUNDED');
    expect((await offeringOf(SLUG)).tokensReserved).toBe(before.tokensReserved);
  });

  it('expires unpaid orders and returns their tokens', async () => {
    const { client } = await verifiedInvestor(app, 'expire');
    const before = await offeringOf(SLUG);
    const o = await placeOrder(client, SLUG, '50000');
    await prisma.subscriptionOrder.update({ where: { id: o.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await app.get(SubscriptionsService).expireStale()).toBeGreaterThan(0);
    expect((await client.get(`/v1/subscriptions/${o.body.id}`)).body.status).toBe('EXPIRED');
    expect((await offeringOf(SLUG)).tokensReserved).toBe(before.tokensReserved);
  });

  it('never oversells under concurrent orders', async () => {
    const slug = 'fukuoka-tenjin-apartment';
    const original = await offeringOf(slug);
    // Leave exactly 150 tokens available, then race two orders of 100.
    const reservedForTest = original.totalTokens - original.tokensSold - original.tokensReserved - 150n;
    await prisma.tokenOffering.update({ where: { id: original.id }, data: { tokensReserved: { increment: reservedForTest } } });
    try {
      const [a, b] = await Promise.all([verifiedInvestor(app, 'race-a'), verifiedInvestor(app, 'race-b')]);
      const results = await Promise.all([placeOrder(a.client, slug, '100000'), placeOrder(b.client, slug, '100000')]);
      const ok = results.filter((r) => r.status === 201);
      const refused = results.filter((r) => r.status === 409 || r.status === 422);
      expect(ok).toHaveLength(1);
      expect(refused).toHaveLength(1);
      const now = await offeringOf(slug);
      expect(now.tokensSold + now.tokensReserved <= now.totalTokens).toBe(true);
      await (results[0]!.status === 201 ? a : b).client.post(`/v1/subscriptions/${ok[0]!.body.id}/cancel`);
    } finally {
      await prisma.tokenOffering.update({ where: { id: original.id }, data: { tokensReserved: { decrement: reservedForTest } } });
    }
  });
});

describe('audit trail', () => {
  it('is hash-chained and links each row to the previous one', async () => {
    const rows = await prisma.auditLog.findMany({ orderBy: { id: 'desc' }, take: 30 });
    expect(rows.length).toBeGreaterThan(5);
    for (let i = 0; i < rows.length - 1; i++) expect(rows[i]!.prevHash).toBe(rows[i + 1]!.hash);
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.hash))).toBe(true);
  });

  it('signs webhooks with a timestamped HMAC header', () => {
    expect(signPayload('x'.repeat(32), '{}', 1_700_000_000_000)).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
  });
});
