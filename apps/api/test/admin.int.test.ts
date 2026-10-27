/**
 * Back office against a real PostgreSQL: staff gating, finance records,
 * distributions (calculate → four-eyes approval → payout → ledger), offering
 * lifecycle rules, roles and the audit chain.
 */
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { applyBps, DEFAULT_WITHHOLDING_BPS } from '@jpt/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { type Client, createApp, invest, registerAndVerify, staffMember, uniqueEmail, verifiedInvestor } from './helpers';

const SLUG = 'tokyo-shibuya-apartment';

let app: INestApplication;
let prisma: PrismaService;
let preparer: { client: Client; email: string; userId: string };
let approver: { client: Client; email: string; userId: string };

beforeAll(async () => {
  ({ app, prisma } = await createApp());
  preparer = await staffMember(app, prisma, 'preparer', ['SUPER_ADMINISTRATOR']);
  approver = await staffMember(app, prisma, 'approver', ['SUPER_ADMINISTRATOR']);
});

afterAll(async () => {
  await app?.close();
});

/** A past month with no finance records or distributions yet for this offering's property. */
async function freshPeriod(offering: { id: string; propertyId: string }) {
  for (;;) {
    const year = 1950 + Math.floor(Math.random() * 70);
    const month = 1 + Math.floor(Math.random() * 12);
    const mm = String(month).padStart(2, '0');
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const start = new Date(`${year}-${mm}-01T00:00:00Z`);
    const end = new Date(`${year}-${mm}-${last}T00:00:00Z`);
    const used =
      (await prisma.rentalIncome.count({ where: { propertyId: offering.propertyId, periodMonth: { gte: start, lte: end } } })) +
      (await prisma.propertyExpense.count({ where: { propertyId: offering.propertyId, incurredAt: { gte: start, lte: end } } })) +
      (await prisma.distribution.count({ where: { offeringId: offering.id, periodStart: start } }));
    if (!used) return { month: `${year}-${mm}`, start: `${year}-${mm}-01`, end: `${year}-${mm}-${last}`, mid: `${year}-${mm}-15` };
  }
}

describe('staff gating', () => {
  it('keeps investors out and requires MFA for staff', async () => {
    const investor = await registerAndVerify(app, uniqueEmail('adm-inv'), 'a long enough passphrase');
    expect((await investor.get('/v1/admin/overview')).body.code).toBe('FORBIDDEN');
    const noMfa = await staffMember(app, prisma, 'adm-nomfa', ['ADMINISTRATOR'], { mfa: false });
    expect((await noMfa.client.get('/v1/admin/overview')).body.code).toBe('STAFF_MFA_REQUIRED');
    const ok = await preparer.client.get('/v1/admin/overview');
    expect(ok.status).toBe(200);
    expect(ok.body.users.total).toBeGreaterThan(0);
  });

  it('checks each permission, not just staff status', async () => {
    const pm = await staffMember(app, prisma, 'adm-pm', ['PROPERTY_MANAGER']);
    expect((await pm.client.get('/v1/admin/audit')).body.code).toBe('FORBIDDEN');
    expect((await pm.client.get('/v1/admin/properties')).status).toBe(200);
  });
});

describe('distributions', () => {
  it('calculates, enforces four-eyes, pays, and posts every yen', async () => {
    const { client: investor } = await verifiedInvestor(app, 'dist-inv');
    await invest(investor, SLUG, '100000');
    const offering = await prisma.tokenOffering.findFirstOrThrow({ where: { property: { slug: SLUG } } });
    const p = await freshPeriod(offering);

    // Finance records
    const base = `/v1/admin/properties/${offering.propertyId}/finance`;
    expect((await preparer.client.post(`${base}/income`, { periodMonth: p.month, amount: '0' })).status).toBe(400);
    expect((await preparer.client.post(`${base}/income`, { periodMonth: p.month, amount: '1000000' })).status).toBe(201);
    for (const [category, amount] of [
      ['PROPERTY_TAX', '50000'],
      ['PLATFORM_FEE', '30000'],
      ['REPAIRS', '20000'],
    ] as const) {
      const r = await preparer.client.post(`${base}/expenses`, { category, amount, incurredAt: p.mid, description: `Test ${category}` });
      expect(r.status).toBe(201);
    }

    const q = `offeringId=${offering.id}&periodStart=${p.start}&periodEnd=${p.end}&reserveAllocation=100000`;
    const preview = await preparer.client.get(`/v1/admin/distributions/preview?${q}`);
    expect(preview.body).toMatchObject({ grossIncome: '1000000', taxes: '50000', fees: '30000', operatingExpenses: '20000', distributableAmount: '800000' });

    const body = { offeringId: offering.id, periodStart: p.start, periodEnd: p.end, reserveAllocation: '100000' };
    const created = await preparer.client.post('/v1/admin/distributions', body);
    expect(created.status).toBe(201);
    const dist = created.body;
    expect(dist.status).toBe('CALCULATED');
    expect(dist.distributableAmount).toBe('800000');
    // Every yen is either allocated to an account or reported as unallocated.
    const allocated = (dist.allocations as Array<{ grossAmount: string }>).reduce((a, x) => a + BigInt(x.grossAmount), 0n);
    expect(allocated.toString()).toBe(dist.allocatedAmount);
    expect(allocated + BigInt(dist.unallocatedAmount)).toBe(800000n);

    const mine = (dist.allocations as Array<{ email: string; grossAmount: string; withholdingTax: string; netAmount: string }>).filter(
      (a) => a.email.startsWith('dist-inv.'),
    );
    for (const a of mine) {
      expect(BigInt(a.withholdingTax)).toBe(applyBps(BigInt(a.grossAmount), DEFAULT_WITHHOLDING_BPS, 'floor'));
      expect(BigInt(a.netAmount)).toBe(BigInt(a.grossAmount) - BigInt(a.withholdingTax));
    }

    expect((await preparer.client.post('/v1/admin/distributions', body)).body.code).toBe('DUPLICATE_PERIOD');
    expect((await preparer.client.post(`/v1/admin/distributions/${dist.id}/pay`)).body.code).toBe('INVALID_STATE');
    expect((await preparer.client.post(`/v1/admin/distributions/${dist.id}/approve`)).body.code).toBe('FOUR_EYES');

    const approved = await approver.client.post(`/v1/admin/distributions/${dist.id}/approve`);
    expect(approved.body.status).toBe('APPROVED');
    expect(approved.body.approvedBy).toBe(approver.email);

    const before = await investor.get('/v1/me/portfolio');
    const paid = await approver.client.post(`/v1/admin/distributions/${dist.id}/pay`);
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('PAID');
    expect((paid.body.allocations as Array<{ status: string }>).every((a) => a.status === 'PAID')).toBe(true);
    expect((await approver.client.post(`/v1/admin/distributions/${dist.id}/pay`)).body.code).toBe('INVALID_STATE');

    // Investor sees the net amount.
    const after = await investor.get('/v1/me/portfolio');
    const myNet = mine.reduce((a, x) => a + BigInt(x.netAmount), 0n);
    expect(BigInt(after.body.totals.distributionsReceived) - BigInt(before.body.totals.distributionsReceived)).toBe(myNet);
    const csv = await investor.get('/v1/me/transactions?format=csv');
    expect(csv.text).toContain('DISTRIBUTION');

    // Ledger: funding entry plus one balanced entry per paid allocation.
    const funded = await prisma.journalEntry.findUniqueOrThrow({ where: { externalKey: `distribution:${dist.id}:funded` }, include: { postings: true } });
    expect(funded.postings.reduce((a, x) => a + x.amount, 0n)).toBe(0n);
    const allocs = await prisma.distributionAllocation.findMany({ where: { distributionId: dist.id } });
    const entries = await prisma.journalEntry.findMany({
      where: { externalKey: { in: allocs.map((a) => `distribution_allocation:${a.id}:paid`) } },
      include: { postings: true },
    });
    expect(entries).toHaveLength(allocs.length);
    for (const e of entries) expect(e.postings.reduce((a, x) => a + x.amount, 0n)).toBe(0n);
    // Payable for this run nets to zero: funded = Σ gross paid out.
    const payableIn = funded.postings.find((x) => x.amount < 0n)!.amount;
    const payableOut = entries.flatMap((e) => e.postings).filter((x) => x.accountId === funded.postings.find((y) => y.amount < 0n)!.accountId);
    expect(payableOut.reduce((a, x) => a + x.amount, 0n) + payableIn).toBe(0n);
  });

  it('refuses a period with expenses above income', async () => {
    const offering = await prisma.tokenOffering.findFirstOrThrow({ where: { property: { slug: SLUG } } });
    const p = await freshPeriod(offering);
    const base = `/v1/admin/properties/${offering.propertyId}/finance`;
    await preparer.client.post(`${base}/income`, { periodMonth: p.month, amount: '10000' });
    await preparer.client.post(`${base}/expenses`, { category: 'REPAIRS', amount: '20000', incurredAt: p.mid, description: 'Large repair' });
    const r = await preparer.client.post('/v1/admin/distributions', { offeringId: offering.id, periodStart: p.start, periodEnd: p.end });
    expect(r.body.code).toBe('NEGATIVE_DISTRIBUTABLE');
  });

  it('cancels a calculated distribution and holds its allocations', async () => {
    const offering = await prisma.tokenOffering.findFirstOrThrow({ where: { property: { slug: SLUG } } });
    const p = await freshPeriod(offering);
    await preparer.client.post(`/v1/admin/properties/${offering.propertyId}/finance/income`, { periodMonth: p.month, amount: '500000' });
    const d = await preparer.client.post('/v1/admin/distributions', { offeringId: offering.id, periodStart: p.start, periodEnd: p.end });
    expect(d.status).toBe(201);
    const c = await preparer.client.post(`/v1/admin/distributions/${d.body.id}/cancel`, { reason: 'Income was recorded twice by mistake.' });
    expect(c.body.status).toBe('CANCELLED');
    expect((c.body.allocations as Array<{ status: string }>).every((a) => a.status === 'HELD')).toBe(true);
    expect((await approver.client.post(`/v1/admin/distributions/${d.body.id}/approve`)).body.code).toBe('INVALID_STATE');
  });
});

describe('offerings and roles', () => {
  it('only allows defined lifecycle moves', async () => {
    const offering = await prisma.tokenOffering.findFirstOrThrow({ where: { property: { slug: SLUG } } });
    expect(offering.status).toBe('OPEN');
    expect((await preparer.client.post(`/v1/admin/offerings/${offering.id}/transition`, { to: 'DRAFT' })).body.code).toBe('INVALID_TRANSITION');
    expect((await preparer.client.post(`/v1/admin/offerings/${offering.id}/transition`, { to: 'CANCELLED' })).body.code).toBe('OFFERING_HAS_INVESTORS');
    expect((await preparer.client.post(`/v1/admin/offerings/${offering.id}/transition`, { to: 'FUNDED' })).body.code).toBe('OFFERING_NOT_FULLY_SOLD');
  });

  it('grants and revokes staff roles, never one’s own', async () => {
    const target = await registerAndVerify(app, uniqueEmail('adm-target'), 'a long enough passphrase');
    const me = await target.get('/v1/auth/me');
    expect((await preparer.client.post(`/v1/admin/users/${preparer.userId}/roles`, { role: 'ADMINISTRATOR', grant: false })).body.code).toBe('SELF_ACTION');
    expect((await preparer.client.post(`/v1/admin/users/${me.body.id}/roles`, { role: 'PROPERTY_MANAGER', grant: true })).status).toBe(204);
    expect((await target.get('/v1/auth/me')).body.roles).toContain('PROPERTY_MANAGER');
    expect((await preparer.client.post(`/v1/admin/users/${me.body.id}/roles`, { role: 'PROPERTY_MANAGER', grant: false })).status).toBe(204);
    // Revoking a role ends the user's sessions.
    expect((await target.get('/v1/auth/me')).status).toBe(401);
  });
});

describe('audit', () => {
  it('lists entries and verifies the whole hash chain', async () => {
    const list = await approver.client.get('/v1/admin/audit?action=distribution.');
    expect(list.status).toBe(200);
    expect((list.body.items as Array<{ action: string }>).some((i) => i.action === 'distribution.approved')).toBe(true);
    const verify = await approver.client.get('/v1/admin/audit/verify');
    expect(verify.body).toMatchObject({ ok: true, firstBrokenId: null });
    expect(verify.body.checked).toBeGreaterThan(10);
  });
});
