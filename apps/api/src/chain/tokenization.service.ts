import { createHmac } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { AllocationStatusKey, ChainOverviewDto, ChainTickDto, OfferingStatusKey, ReconciliationDto } from '@jpt/shared';
import { toWire } from '@jpt/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../common/request-context';
import { APP_ENV, type AppEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ChainGateway } from './chain-gateway';

/** Offerings whose tokens may exist: approved by counsel (or DEMO) and not cancelled. */
const DEPLOYABLE: OfferingStatusKey[] = ['APPROVED', 'COMING_SOON', 'OPEN', 'FUNDED', 'CLOSED'];
const BATCH = 50;

/**
 * Keeps the on-chain register in step with the legal register in PostgreSQL:
 *
 *   1. submit   PENDING allocations → custodial wallet ensured, identity
 *               registered, mint submitted (idempotent per allocation attempt)
 *   2. confirm  MINT_SUBMITTED → MINTED after N confirmations; reverted mints
 *               are retried up to CHAIN_MAX_ATTEMPTS, then parked as FAILED
 *   3. reconcile every deployed token: on-chain balances and supply must equal
 *               what the database says was minted
 *
 * The database stays the source of truth: the chain never creates an
 * allocation, it only confirms or contradicts one.
 */
@Injectable()
export class TokenizationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenizationService.name);
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<ChainTickDto> | null = null;
  private readonly lastReconciliation = new Map<string, ReconciliationDto>();
  private readonly lastMismatchKey = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ChainGateway,
    private readonly audit: AuditService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  onModuleInit() {
    if (this.env.NODE_ENV !== 'test' && this.env.CHAIN_WORKER_INTERVAL_MS > 0) {
      this.timer = setInterval(() => {
        this.tick().catch((e: unknown) => this.logger.error(`chain worker: ${String(e)}`));
      }, this.env.CHAIN_WORKER_INTERVAL_MS);
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** One worker pass. Concurrent callers share the pass already running. */
  tick(): Promise<ChainTickDto> {
    if (!this.running) {
      this.running = this.pass().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  // --- deployment -------------------------------------------------------------

  async deploy(auth: AuthContext, offeringId: string) {
    const offering = await this.prisma.tokenOffering.findUnique({ where: { id: offeringId }, include: { contract: true } });
    if (!offering) throw new NotFoundException({ code: 'OFFERING_NOT_FOUND', message: 'Offering not found' });
    if (!DEPLOYABLE.includes(offering.status as OfferingStatusKey)) {
      throw new ConflictException({ code: 'OFFERING_NOT_DEPLOYABLE', message: 'Only approved, open, funded or closed offerings get a token contract' });
    }
    if (offering.contract?.status === 'DEPLOYED') {
      throw new ConflictException({ code: 'CONTRACT_ALREADY_DEPLOYED', message: 'This offering already has a deployed token' });
    }
    const result = await this.gateway.deploy({
      ref: `deploy:${offering.id}`,
      offeringRef: offering.id,
      name: offering.tokenName,
      symbol: offering.tokenSymbol,
      maxSupply: offering.totalTokens,
      // DEMO subscriptions accept every jurisdiction in simulation; a real
      // deployment restricts to Japan residents (see DeployOffering.s.sol).
      allowedCountries: offering.isDemo ? null : ['JP'],
    });
    const data = {
      chainId: this.gateway.chainId,
      network: this.gateway.network,
      standard: 'ERC3643' as const,
      status: 'DEPLOYED' as const,
      address: result.token,
      identityRegistry: result.identityRegistry,
      complianceModule: result.compliance,
      deployTxHash: result.txHash,
      deployedBlock: result.blockNumber,
      deployedAt: new Date(),
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.tokenContract.upsert({ where: { offeringId }, create: { offeringId, ...data }, update: data });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: auth.userId,
        action: 'token.contract_deployed',
        entityType: 'TokenOffering',
        entityId: offeringId,
        after: { network: data.network, token: result.token, txHash: result.txHash },
      });
    });
    return { address: result.token, txHash: result.txHash };
  }

  /** Manual review of a parked allocation: send it back to the queue. */
  async retry(auth: AuthContext, allocationId: string) {
    const a = await this.prisma.tokenAllocation.findUnique({ where: { id: allocationId } });
    if (!a) throw new NotFoundException({ code: 'ALLOCATION_NOT_FOUND', message: 'Allocation not found' });
    if (a.status !== 'FAILED') throw new BadRequestException({ code: 'INVALID_STATE', message: 'Only failed allocations can be retried' });
    await this.prisma.$transaction(async (tx) => {
      await tx.tokenAllocation.update({ where: { id: a.id }, data: { status: 'PENDING', txHash: null, chainId: null } });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: auth.userId,
        action: 'token.mint_requeued',
        entityType: 'TokenAllocation',
        entityId: a.id,
        before: { status: a.status, attempts: a.attempts, reason: a.failureReason },
      });
    });
  }

  // --- worker pass --------------------------------------------------------------

  private async pass(): Promise<ChainTickDto> {
    const result: ChainTickDto = { submitted: 0, confirmed: 0, retried: 0, failed: 0, reconciled: 0, mismatches: 0 };
    await this.submitPending(result);
    await this.confirmSubmitted(result);
    await this.reconcileAll(result);
    return result;
  }

  private async submitPending(result: ChainTickDto) {
    const pending = await this.prisma.tokenAllocation.findMany({
      where: { status: 'PENDING', offering: { contract: { status: 'DEPLOYED', chainId: this.gateway.chainId } } },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
      include: { offering: { include: { contract: true } } },
    });
    for (const a of pending) {
      const contract = a.offering.contract!;
      try {
        const wallet = await this.ensureRegisteredWallet(a.userId, contract.identityRegistry!);
        if (!wallet) {
          await this.prisma.tokenAllocation.update({ where: { id: a.id }, data: { failureReason: 'INVESTOR_NOT_VERIFIED' } });
          continue;
        }
        const { txHash } = await this.gateway.mint({ ref: `mint:${a.id}:${a.attempts}`, token: contract.address!, to: wallet.address, amount: a.tokens });
        await this.prisma.$transaction(async (tx) => {
          const moved = await tx.tokenAllocation.updateMany({
            where: { id: a.id, status: 'PENDING' },
            data: { status: 'MINT_SUBMITTED', walletId: wallet.id, chainId: this.gateway.chainId, txHash, attempts: { increment: 1 }, failureReason: null },
          });
          if (moved.count === 1) {
            await this.audit.record(tx, {
              actorType: 'SYSTEM',
              action: 'token.mint_submitted',
              entityType: 'TokenAllocation',
              entityId: a.id,
              after: { token: contract.address, wallet: wallet.address, tokens: a.tokens, txHash, attempt: a.attempts + 1 },
            });
          }
        });
        result.submitted++;
      } catch (e) {
        // Gateway unreachable or rejected the request: count the attempt.
        const attempts = a.attempts + 1;
        const reason = e instanceof Error ? e.message.slice(0, 500) : 'submit failed';
        await this.prisma.tokenAllocation.update({
          where: { id: a.id },
          data: { attempts, failureReason: reason, status: attempts >= this.env.CHAIN_MAX_ATTEMPTS ? 'FAILED' : 'PENDING' },
        });
        this.logger.warn(`mint submit failed for allocation ${a.id}: ${reason}`);
      }
    }
  }

  private async confirmSubmitted(result: ChainTickDto) {
    const submitted = await this.prisma.tokenAllocation.findMany({
      where: { status: 'MINT_SUBMITTED', chainId: this.gateway.chainId },
      orderBy: { updatedAt: 'asc' },
      take: BATCH * 2,
    });
    for (const a of submitted) {
      const r = await this.gateway.receipt(a.txHash!);
      if (r.status === 'PENDING' || (r.status === 'CONFIRMED' && r.confirmations < this.env.CHAIN_CONFIRMATIONS)) continue;

      if (r.status === 'CONFIRMED') {
        await this.prisma.$transaction(async (tx) => {
          const done = await tx.tokenAllocation.updateMany({
            where: { id: a.id, status: 'MINT_SUBMITTED' },
            data: { status: 'MINTED', blockNumber: r.blockNumber, mintedAt: new Date() },
          });
          if (done.count === 1) {
            await this.audit.record(tx, {
              actorType: 'SYSTEM',
              action: 'token.minted',
              entityType: 'TokenAllocation',
              entityId: a.id,
              after: { txHash: a.txHash, blockNumber: r.blockNumber, confirmations: r.confirmations },
            });
          }
        });
        result.confirmed++;
        continue;
      }

      // FAILED (reverted) or UNKNOWN (dropped): retry with a new attempt, or park.
      const reason = r.status === 'FAILED' ? `Reverted: ${r.error ?? 'unknown reason'}` : 'Transaction not found on chain';
      const park = a.attempts >= this.env.CHAIN_MAX_ATTEMPTS;
      await this.prisma.$transaction(async (tx) => {
        const moved = await tx.tokenAllocation.updateMany({
          where: { id: a.id, status: 'MINT_SUBMITTED' },
          data: { status: park ? 'FAILED' : 'PENDING', txHash: null, chainId: null, failureReason: `${reason} (tx ${a.txHash})` },
        });
        if (moved.count === 1) {
          await this.audit.record(tx, {
            actorType: 'SYSTEM',
            action: park ? 'token.mint_failed' : 'token.mint_retry',
            entityType: 'TokenAllocation',
            entityId: a.id,
            after: { txHash: a.txHash, reason, attempts: a.attempts },
          });
        }
      });
      if (park) result.failed++;
      else result.retried++;
    }
  }

  private async reconcileAll(result: ChainTickDto) {
    const contracts = await this.prisma.tokenContract.findMany({ where: { status: 'DEPLOYED', chainId: this.gateway.chainId } });
    const head = await this.gateway.head();
    for (const c of contracts) {
      const rec = await this.reconcile(c.offeringId, c.address!);
      result.reconciled++;
      result.mismatches += rec.mismatches.length + (rec.expectedSupply === rec.onChainSupply ? 0 : 1);
      await this.prisma.tokenContract.update({ where: { id: c.id }, data: { lastIndexedBlock: head - BigInt(this.env.CHAIN_CONFIRMATIONS) + 1n } });
    }
  }

  private async reconcile(offeringId: string, token: string): Promise<ReconciliationDto> {
    const minted = await this.prisma.tokenAllocation.groupBy({
      by: ['walletId'],
      where: { offeringId, status: 'MINTED' },
      _sum: { tokens: true },
    });
    const walletIds = minted.map((m) => m.walletId).filter((x): x is string => !!x);
    const wallets = await this.prisma.wallet.findMany({ where: { id: { in: walletIds } }, include: { user: { select: { email: true } } } });
    const byId = new Map(wallets.map((w) => [w.id, w]));

    const mismatches: ReconciliationDto['mismatches'] = [];
    let expectedSupply = 0n;
    for (const m of minted) {
      const expected = m._sum.tokens ?? 0n;
      expectedSupply += expected;
      const w = m.walletId ? byId.get(m.walletId) : undefined;
      if (!w) continue;
      const onChain = await this.gateway.balanceOf(token, w.address);
      if (onChain !== expected) mismatches.push({ wallet: w.address, email: w.user.email, expected: toWire(expected), onChain: toWire(onChain) });
    }
    const onChainSupply = await this.gateway.totalSupply(token);
    const rec: ReconciliationDto = {
      checkedAt: new Date().toISOString(),
      ok: mismatches.length === 0 && onChainSupply === expectedSupply,
      expectedSupply: toWire(expectedSupply),
      onChainSupply: toWire(onChainSupply),
      mismatches,
    };
    this.lastReconciliation.set(offeringId, rec);

    // Audit transitions only, not every pass.
    const key = rec.ok ? 'ok' : JSON.stringify([rec.expectedSupply, rec.onChainSupply, mismatches]);
    if (this.lastMismatchKey.get(offeringId) !== key) {
      if (!rec.ok || this.lastMismatchKey.has(offeringId)) {
        await this.prisma.$transaction((tx) =>
          this.audit.record(tx, {
            actorType: 'SYSTEM',
            action: rec.ok ? 'token.reconciliation_restored' : 'token.reconciliation_mismatch',
            entityType: 'TokenOffering',
            entityId: offeringId,
            after: { expectedSupply: rec.expectedSupply, onChainSupply: rec.onChainSupply, mismatches },
          }),
        );
      }
      this.lastMismatchKey.set(offeringId, key);
    }
    return rec;
  }

  // --- wallets and identities -------------------------------------------------

  /**
   * Custodial wallet for the investor (simulated custodian: deterministic
   * address, no keys anywhere) registered in the identity registry with the
   * validity of the investor's KYC. Returns null if the KYC is not valid.
   */
  private async ensureRegisteredWallet(userId: string, identityRegistry: string) {
    const kyc = await this.prisma.kycVerification.findFirst({
      where: { userId, status: 'APPROVED', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { profile: { select: { countryOfResidence: true } } } } },
    });
    const country = kyc?.user.profile?.countryOfResidence;
    if (!kyc?.expiresAt || !country) return null;

    const chainId = this.gateway.chainId;
    let wallet = await this.prisma.wallet.findFirst({ where: { userId, chainId, type: 'CUSTODIAL', status: { in: ['ACTIVE', 'PENDING_VERIFICATION'] } } });
    if (!wallet) {
      const address = `0x${this.keyed(`wallet:${userId}`).slice(0, 40)}`;
      wallet = await this.prisma.wallet.upsert({
        where: { chainId_address: { chainId, address } },
        create: { userId, chainId, address, type: 'CUSTODIAL', status: 'PENDING_VERIFICATION', custodyProvider: this.gateway.network, custodyReference: `custody:${userId}` },
        update: {},
      });
    }
    if (!wallet.whitelistedAt) {
      await this.gateway.registerIdentity({
        ref: `register:${identityRegistry}:${wallet.address}`,
        identityRegistry,
        wallet: wallet.address,
        investorId: `0x${this.keyed(`investor:${userId}`)}`,
        country,
        expiresAt: kyc.expiresAt,
      });
      wallet = await this.prisma.wallet.update({ where: { id: wallet.id }, data: { whitelistedAt: new Date(), status: 'ACTIVE' } });
    }
    return wallet;
  }

  /** Keyed so investor ids and wallet addresses cannot be linked back to user ids. */
  private keyed(value: string): string {
    return createHmac('sha256', Buffer.from(this.env.PII_ENCRYPTION_KEY, 'hex')).update(`jpt:chain:${value}`).digest('hex');
  }

  // --- read model ---------------------------------------------------------------

  async overview(): Promise<ChainOverviewDto> {
    const [offerings, counts, mintedSums, failed] = await Promise.all([
      this.prisma.tokenOffering.findMany({
        where: { status: { not: 'DRAFT' } },
        orderBy: { tokenSymbol: 'asc' },
        include: { contract: true, property: { select: { name: true } } },
      }),
      this.prisma.tokenAllocation.groupBy({ by: ['offeringId', 'status'], _count: { _all: true } }),
      this.prisma.tokenAllocation.groupBy({ by: ['offeringId'], where: { status: 'MINTED' }, _sum: { tokens: true } }),
      this.prisma.tokenAllocation.findMany({
        where: { status: 'FAILED' },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        include: { offering: { select: { tokenSymbol: true } }, user: { select: { email: true } } },
      }),
    ]);
    const empty = (): Record<AllocationStatusKey, number> => ({ PENDING: 0, MINT_SUBMITTED: 0, MINTED: 0, FAILED: 0, REVERSED: 0 });
    return {
      gateway: {
        kind: this.gateway.kind,
        network: this.gateway.network,
        chainId: this.gateway.chainId,
        head: (await this.gateway.head()).toString(),
        confirmations: this.env.CHAIN_CONFIRMATIONS,
      },
      offerings: offerings.map((o) => {
        const allocations = empty();
        for (const c of counts) if (c.offeringId === o.id) allocations[c.status] = c._count._all;
        const c = o.contract;
        return {
          offeringId: o.id,
          tokenSymbol: o.tokenSymbol,
          propertyName: o.property.name,
          offeringStatus: o.status,
          isDemo: o.isDemo,
          totalTokens: toWire(o.totalTokens),
          tokensSold: toWire(o.tokensSold),
          contract: c
            ? {
                status: c.status,
                network: c.network,
                chainId: c.chainId,
                address: c.address,
                identityRegistry: c.identityRegistry,
                complianceModule: c.complianceModule,
                deployTxHash: c.deployTxHash,
                deployedAt: c.deployedAt?.toISOString() ?? null,
                lastIndexedBlock: c.lastIndexedBlock?.toString() ?? null,
              }
            : null,
          allocations,
          mintedTokens: toWire(mintedSums.find((m) => m.offeringId === o.id)?._sum.tokens ?? 0n),
          reconciliation: this.lastReconciliation.get(o.id) ?? null,
        };
      }),
      failed: failed.map((a) => ({
        allocationId: a.id,
        tokenSymbol: a.offering.tokenSymbol,
        email: a.user.email,
        tokens: toWire(a.tokens),
        attempts: a.attempts,
        reason: a.failureReason,
      })),
    };
  }
}
