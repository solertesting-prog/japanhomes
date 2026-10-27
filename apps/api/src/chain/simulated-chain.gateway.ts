import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@jpt/database';
import { APP_ENV, type AppEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChainGateway,
  type DeployInput,
  type DeployResult,
  type MintInput,
  type RegisterIdentityInput,
  type TxReceipt,
} from './chain-gateway';

/** Block 0 of the simulated chain; heights derive from the clock, so they survive restarts. */
const GENESIS_MS = Date.UTC(2026, 0, 1);

interface DeployPayload {
  offeringRef: string;
  name: string;
  symbol: string;
  maxSupply: string;
  identityRegistry: string;
  compliance: string;
  allowedCountries: string[] | null;
}

const hex = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * DEMO chain kept in PostgreSQL. It applies the same rules as the Solidity
 * contracts at the moment a transaction is "mined" (receiver registered and not
 * expired, allowed country, max supply) so failures and retries can be
 * exercised without a network. Hashes and addresses are SHA-256 derived and do
 * not exist on any real chain.
 */
@Injectable()
export class SimulatedChainGateway extends ChainGateway {
  readonly kind = 'simulated' as const;
  readonly chainId = 0;
  readonly network = 'simulated';

  /** Test/dev hooks. */
  private extraBlocks = 0n;
  private failNext: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {
    super();
  }

  async head(): Promise<bigint> {
    return BigInt(Math.floor((Date.now() - GENESIS_MS) / this.env.CHAIN_BLOCK_TIME_MS)) + this.extraBlocks;
  }

  advance(blocks: number): void {
    this.extraBlocks += BigInt(blocks);
  }

  failNextMint(reason: string): void {
    this.failNext = reason;
  }

  async deploy(input: DeployInput): Promise<DeployResult> {
    const token = `0x${hex(`token:${input.ref}`).slice(0, 40)}`;
    const payload: DeployPayload = {
      offeringRef: input.offeringRef,
      name: input.name,
      symbol: input.symbol,
      maxSupply: input.maxSupply.toString(),
      identityRegistry: this.platformRegistry(),
      compliance: `0x${hex(`compliance:${input.ref}`).slice(0, 40)}`,
      allowedCountries: input.allowedCountries,
    };
    const tx = await this.submit({ kind: 'DEPLOY', contract: token, ref: input.ref, payload, decide: async () => null });
    return {
      token,
      identityRegistry: payload.identityRegistry,
      compliance: payload.compliance,
      txHash: tx.txHash,
      blockNumber: tx.blockNumber,
    };
  }

  async registerIdentity(input: RegisterIdentityInput): Promise<{ txHash: string }> {
    const tx = await this.submit({
      kind: 'REGISTER_IDENTITY',
      contract: input.identityRegistry,
      ref: input.ref,
      wallet: input.wallet,
      payload: { investorId: input.investorId, country: input.country.toUpperCase(), expiresAt: input.expiresAt.toISOString() },
      decide: async (db) => {
        if (input.expiresAt <= new Date()) return 'ExpiryInPast';
        const existing = await db.simulatedChainTx.count({
          where: { kind: 'REGISTER_IDENTITY', contract: input.identityRegistry, wallet: input.wallet, status: 'CONFIRMED' },
        });
        return existing ? `AlreadyRegistered(${input.wallet})` : null;
      },
    });
    return { txHash: tx.txHash };
  }

  async mint(input: MintInput): Promise<{ txHash: string }> {
    const tx = await this.submit({
      kind: 'MINT',
      contract: input.token,
      ref: input.ref,
      wallet: input.to,
      amount: input.amount,
      decide: async (db) => {
        if (this.failNext) {
          const reason = this.failNext;
          this.failNext = null;
          return reason;
        }
        const deployed = await this.deployment(db, input.token);
        if (!deployed) return 'NoContractAtAddress';
        const identity = await db.simulatedChainTx.findFirst({
          where: { kind: 'REGISTER_IDENTITY', contract: deployed.identityRegistry, wallet: input.to, status: 'CONFIRMED' },
          orderBy: { createdAt: 'desc' },
        });
        const id = identity?.payload as { country?: string; expiresAt?: string } | null;
        if (!id?.expiresAt || new Date(id.expiresAt) <= new Date()) return `NotVerified(${input.to})`;
        if (deployed.allowedCountries && !deployed.allowedCountries.includes(id.country ?? '')) {
          return 'NotCompliant(COUNTRY_NOT_ALLOWED)';
        }
        const supply = await this.mintedSum(db, input.token);
        const available = BigInt(deployed.maxSupply) - supply;
        if (input.amount > available) return `MaxSupplyExceeded(${input.amount}, ${available})`;
        return null;
      },
    });
    return { txHash: tx.txHash };
  }

  async receipt(txHash: string): Promise<TxReceipt> {
    const tx = await this.prisma.simulatedChainTx.findUnique({ where: { txHash } });
    if (!tx) return { status: 'UNKNOWN', blockNumber: null, confirmations: 0, error: null };
    const head = await this.head();
    if (tx.blockNumber > head) return { status: 'PENDING', blockNumber: null, confirmations: 0, error: null };
    return {
      status: tx.status,
      blockNumber: tx.blockNumber,
      confirmations: Number(head - tx.blockNumber + 1n),
      error: tx.error,
    };
  }

  async balanceOf(token: string, wallet: string): Promise<bigint> {
    const r = await this.prisma.simulatedChainTx.aggregate({
      where: { kind: 'MINT', contract: token, wallet, status: 'CONFIRMED', blockNumber: { lte: await this.head() } },
      _sum: { amount: true },
    });
    return r._sum.amount ?? 0n;
  }

  async totalSupply(token: string): Promise<bigint> {
    const r = await this.prisma.simulatedChainTx.aggregate({
      where: { kind: 'MINT', contract: token, status: 'CONFIRMED', blockNumber: { lte: await this.head() } },
      _sum: { amount: true },
    });
    return r._sum.amount ?? 0n;
  }

  // ---------------------------------------------------------------------------

  private platformRegistry(): string {
    return `0x${hex('identity-registry:platform').slice(0, 40)}`;
  }

  private async deployment(db: Prisma.TransactionClient, token: string): Promise<DeployPayload | null> {
    const d = await db.simulatedChainTx.findFirst({ where: { kind: 'DEPLOY', contract: token, status: 'CONFIRMED' } });
    return (d?.payload as unknown as DeployPayload | undefined) ?? null;
  }

  /** Includes not-yet-mined mints: they are ahead in the same queue. */
  private async mintedSum(db: Prisma.TransactionClient, token: string): Promise<bigint> {
    const r = await db.simulatedChainTx.aggregate({ where: { kind: 'MINT', contract: token, status: 'CONFIRMED' }, _sum: { amount: true } });
    return r._sum.amount ?? 0n;
  }

  /**
   * Serialises writes (one sequencer), de-duplicates by ref and decides the
   * outcome against the state every earlier transaction produced.
   */
  private async submit(args: {
    kind: 'DEPLOY' | 'REGISTER_IDENTITY' | 'MINT';
    contract: string;
    ref: string;
    wallet?: string;
    amount?: bigint;
    payload?: unknown;
    decide: (db: Prisma.TransactionClient) => Promise<string | null>;
  }): Promise<{ txHash: string; blockNumber: bigint }> {
    const blockNumber = (await this.head()) + 1n;
    return this.prisma.$transaction(async (db) => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('jpt:simulated-chain'))`;
      const existing = await db.simulatedChainTx.findUnique({ where: { ref: args.ref } });
      if (existing) return { txHash: existing.txHash, blockNumber: existing.blockNumber };
      const error = await args.decide(db);
      const txHash = `0x${hex(`tx:${args.kind}:${args.ref}`)}`;
      await db.simulatedChainTx.create({
        data: {
          txHash,
          kind: args.kind,
          contract: args.contract,
          ref: args.ref,
          wallet: args.wallet ?? null,
          amount: args.amount ?? null,
          payload: args.payload === undefined ? Prisma.JsonNull : (args.payload as Prisma.InputJsonValue),
          status: error ? 'FAILED' : 'CONFIRMED',
          error: error?.slice(0, 200) ?? null,
          blockNumber,
        },
      });
      return { txHash, blockNumber };
    });
  }
}
