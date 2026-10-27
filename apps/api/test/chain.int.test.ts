/**
 * Tokenization against a real PostgreSQL and the simulated chain: contract
 * deployment, allocation worker (submit → confirmations → minted), reverted
 * mints retried then parked, manual requeue, reconciliation of on-chain
 * balances against the database, and access control.
 */
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { ChainOverviewDto, ChainTickDto } from '@jpt/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SimulatedChainGateway } from '../src/chain/simulated-chain.gateway';
import type { PrismaService } from '../src/prisma/prisma.service';
import { type Client, createApp, invest, registerAndVerify, staffMember, uniqueEmail, verifiedInvestor } from './helpers';

const SLUG = 'sapporo-maruyama-house';

let app: INestApplication;
let prisma: PrismaService;
let ops: { client: Client; email: string; userId: string };
let offering: { id: string; minimumInvestment: bigint; tokenPrice: bigint };

const tick = async (): Promise<ChainTickDto> => {
  const r = await ops.client.post('/v1/admin/chain/tick');
  expect(r.status).toBe(200);
  return r.body as ChainTickDto;
};
const advance = (blocks: number) => ops.client.post('/v1/dev/chain/advance', { blocks });
const allocationOf = (orderId: string) => prisma.tokenAllocation.findUniqueOrThrow({ where: { orderId } });
const overview = async () => (await ops.client.get('/v1/admin/chain')).body as ChainOverviewDto;
const mine = async (o: ChainOverviewDto) => o.offerings.find((x) => x.offeringId === offering.id)!;

beforeAll(async () => {
  ({ app, prisma } = await createApp());
  ops = await staffMember(app, prisma, 'chain-ops', ['SUPER_ADMINISTRATOR']);
  offering = await prisma.tokenOffering.findFirstOrThrow({ where: { property: { slug: SLUG } } });
});

afterAll(async () => {
  await app?.close();
});

const amount = () => offering.minimumInvestment.toString();

describe('access', () => {
  it('requires the token:operate permission', async () => {
    const investor = await registerAndVerify(app, uniqueEmail('chain-inv'), 'a long enough passphrase');
    expect((await investor.get('/v1/admin/chain')).body.code).toBe('FORBIDDEN');
    const pm = await staffMember(app, prisma, 'chain-pm', ['PROPERTY_MANAGER']);
    expect((await pm.client.get('/v1/admin/chain')).body.code).toBe('FORBIDDEN');
    expect((await pm.client.post(`/v1/admin/offerings/${offering.id}/contract`)).body.code).toBe('FORBIDDEN');
  });
});

describe('deployment and minting', () => {
  it('deploys once, then mints allocations after the required confirmations', async () => {
    const { client: investor } = await verifiedInvestor(app, 'chain-a');
    const orderId = await invest(investor, SLUG, amount());
    expect((await allocationOf(orderId)).status).toBe('PENDING');

    // Without a deployed contract the worker leaves the allocation alone.
    const before = await mine(await overview());
    if (before.contract?.status !== 'DEPLOYED') {
      await tick();
      expect((await allocationOf(orderId)).status).toBe('PENDING');
      const deployed = await ops.client.post(`/v1/admin/offerings/${offering.id}/contract`);
      expect(deployed.status).toBe(201);
      expect(deployed.body.address).toMatch(/^0x[0-9a-f]{40}$/);
    }
    const again = await ops.client.post(`/v1/admin/offerings/${offering.id}/contract`);
    expect(again.body.code).toBe('CONTRACT_ALREADY_DEPLOYED');

    const t1 = await tick();
    expect(t1.submitted).toBeGreaterThanOrEqual(1);
    const submitted = await allocationOf(orderId);
    expect(submitted.status).toBe('MINT_SUBMITTED');
    expect(submitted.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(submitted.attempts).toBe(1);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: submitted.walletId! } });
    expect(wallet.type).toBe('CUSTODIAL');
    expect(wallet.whitelistedAt).not.toBeNull();

    // Not mined yet, then mined with 1 confirmation: still not final.
    await tick();
    expect((await allocationOf(orderId)).status).toBe('MINT_SUBMITTED');
    await advance(1);
    await tick();
    expect((await allocationOf(orderId)).status).toBe('MINT_SUBMITTED');
    await advance(1);
    await tick();
    const minted = await allocationOf(orderId);
    expect(minted.status).toBe('MINTED');
    expect(minted.blockNumber).not.toBeNull();

    const chain = app.get(SimulatedChainGateway);
    const token = (await prisma.tokenContract.findUniqueOrThrow({ where: { offeringId: offering.id } })).address!;
    expect(await chain.balanceOf(token, wallet.address)).toBe(minted.tokens);

    const o = await mine(await overview());
    expect(o.contract?.status).toBe('DEPLOYED');
    expect(o.reconciliation?.ok).toBe(true);
    expect(o.allocations.MINTED).toBeGreaterThanOrEqual(1);

    const portfolio = await investor.get('/v1/me/portfolio');
    const holding = portfolio.body.holdings.find((h: { offeringId: string }) => h.offeringId === offering.id);
    expect(holding.onChain.mintedTokens).toBe(minted.tokens.toString());
    expect(holding.onChain.pendingTokens).toBe('0');
    expect(holding.onChain.wallet).toBe(wallet.address);

    const actions = (await prisma.auditLog.findMany({ where: { entityId: minted.id } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['token.mint_submitted', 'token.minted']));
  });

  it('is idempotent per reference', async () => {
    const chain = app.get(SimulatedChainGateway);
    const token = (await prisma.tokenContract.findUniqueOrThrow({ where: { offeringId: offering.id } })).address!;
    const a = await chain.mint({ ref: 'idem-test-ref', token, to: '0x0000000000000000000000000000000000000001', amount: 1n });
    const b = await chain.mint({ ref: 'idem-test-ref', token, to: '0x0000000000000000000000000000000000000001', amount: 1n });
    expect(a.txHash).toBe(b.txHash);
    // Unregistered receiver: the simulated contract reverts, like the real one.
    await advance(2);
    const r = await chain.receipt(a.txHash);
    expect(r.status).toBe('FAILED');
    expect(r.error).toMatch(/^NotVerified/);
  });
});

describe('failures', () => {
  it('retries a reverted mint, then parks it for manual review and requeues on request', async () => {
    const { client: investor } = await verifiedInvestor(app, 'chain-fail');
    const orderId = await invest(investor, SLUG, amount());

    // Attempt 1 reverts → back to the queue.
    await ops.client.post('/v1/dev/chain/fail-next-mint', { reason: 'NotCompliant(TEST_ONE)' });
    await tick();
    await advance(2);
    const r1 = await tick();
    expect(r1.retried).toBeGreaterThanOrEqual(1);
    let a = await allocationOf(orderId);
    expect(a.status).toBe('PENDING');
    expect(a.failureReason).toContain('TEST_ONE');

    // Attempts 2 and 3 revert too → parked as FAILED.
    for (const n of [2, 3]) {
      await ops.client.post('/v1/dev/chain/fail-next-mint', { reason: `NotCompliant(TEST_${n})` });
      await tick();
      expect((await allocationOf(orderId)).attempts).toBe(n);
      await advance(2);
      await tick();
    }
    a = await allocationOf(orderId);
    expect(a.status).toBe('FAILED');
    const o = await overview();
    expect(o.failed.some((f) => f.allocationId === a.id)).toBe(true);

    // Manual requeue → minted on the next clean attempt.
    expect((await ops.client.post(`/v1/admin/chain/allocations/${a.id}/retry`)).status).toBe(204);
    expect((await ops.client.post(`/v1/admin/chain/allocations/${a.id}/retry`)).body.code).toBe('INVALID_STATE');
    await tick();
    await advance(2);
    await tick();
    a = await allocationOf(orderId);
    expect(a.status).toBe('MINTED');
    expect(a.attempts).toBe(4);
  });

  it('flags on-chain balances that disagree with the database', async () => {
    const contract = await prisma.tokenContract.findUniqueOrThrow({ where: { offeringId: offering.id } });
    const minted = await prisma.tokenAllocation.findFirstOrThrow({ where: { offeringId: offering.id, status: 'MINTED' }, include: { wallet: true } });
    // An unexpected mint appears on-chain (e.g. an agent key used outside the platform).
    const rogue = `0x${'ab'.repeat(32)}`;
    await prisma.simulatedChainTx.create({
      data: { txHash: rogue, kind: 'MINT', contract: contract.address!, ref: `rogue-${Date.now()}`, wallet: minted.wallet!.address, amount: 5n, status: 'CONFIRMED', blockNumber: 1n },
    });
    try {
      const t = await tick();
      expect(t.mismatches).toBeGreaterThanOrEqual(1);
      const rec = (await mine(await overview())).reconciliation!;
      expect(rec.ok).toBe(false);
      expect(rec.mismatches.some((m) => m.wallet === minted.wallet!.address)).toBe(true);
      const audit = await prisma.auditLog.findFirst({ where: { entityId: offering.id, action: 'token.reconciliation_mismatch' }, orderBy: { id: 'desc' } });
      expect(audit).not.toBeNull();
    } finally {
      await prisma.simulatedChainTx.delete({ where: { txHash: rogue } });
    }
    await tick();
    expect((await mine(await overview())).reconciliation?.ok).toBe(true);
  });
});
