import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@jpt/database';

export interface AuditEntry {
  actorType: 'USER' | 'SYSTEM' | 'WEBHOOK';
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  requestId?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
}

/** JSON with stable key order and bigint as string, so hashes are reproducible. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === 'bigint') return v.toString();
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      return Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]]));
    }
    return v;
  });
}

const toJson = (v: unknown): Prisma.InputJsonValue | undefined =>
  v === undefined ? undefined : (JSON.parse(canonicalJson(v)) as Prisma.InputJsonValue);

/**
 * Append-only, hash-chained audit trail. Each row's hash covers the previous
 * row's hash, so deleting or editing a row (already blocked by a DB trigger)
 * would also be detectable offline. Must be called inside the business
 * transaction so the audit row and the change commit together.
 */
/** Canonical body hashed for a row: every column, nulls included, so it can be recomputed from storage. */
export function auditBody(row: {
  actorType: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  requestId: string | null;
  ipHash: string | null;
  userAgent: string | null;
  occurredAt: Date;
}): string {
  return canonicalJson({
    v: 2,
    actorType: row.actorType,
    actorUserId: row.actorUserId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    before: row.before ?? null,
    after: row.after ?? null,
    requestId: row.requestId,
    ipHash: row.ipHash,
    userAgent: row.userAgent,
    occurredAt: row.occurredAt.toISOString(),
  });
}

export const chainHash = (prevHash: string | null, body: string) => createHash('sha256').update(`${prevHash ?? ''}|${body}`).digest('hex');

/**
 * Append-only, hash-chained audit trail. Each row's hash covers the previous
 * row's hash and every stored column, so deleting or editing a row (already
 * blocked by a DB trigger) is also detectable offline — see verify().
 * Must be called inside the business transaction so the audit row and the
 * change commit together.
 */
@Injectable()
export class AuditService {
  async record(tx: Prisma.TransactionClient, e: AuditEntry): Promise<void> {
    // Serialise writers so the chain has no forks.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242)`;
    const last = await tx.auditLog.findFirst({ orderBy: { id: 'desc' }, select: { hash: true } });
    const row = {
      occurredAt: new Date(),
      actorType: e.actorType,
      actorUserId: e.actorUserId ?? null,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      before: toJson(e.before),
      after: toJson(e.after),
      requestId: e.requestId ?? null,
      ipHash: e.ipHash ?? null,
      userAgent: e.userAgent?.slice(0, 512) ?? null,
    };
    const prevHash = last?.hash ?? null;
    const hash = chainHash(prevHash, auditBody(row));
    await tx.auditLog.create({ data: { ...row, prevHash, hash } });
  }

  /**
   * Walks the chain in insertion order and recomputes every hash. Rows from
   * the first prototype format (body without null columns) are accepted
   * through a legacy check so existing development databases still verify.
   */
  async verify(prisma: Pick<Prisma.TransactionClient, 'auditLog'>) {
    let prev: string | null = null;
    let checked = 0;
    let cursor: bigint | undefined;
    for (;;) {
      const batch = await prisma.auditLog.findMany({
        orderBy: { id: 'asc' },
        take: 1000,
        ...(cursor !== undefined ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!batch.length) break;
      for (const r of batch) {
        checked++;
        if ((r.prevHash ?? null) !== prev) {
          return { checked, ok: false, firstBrokenId: r.id.toString(), reason: 'Link to the previous entry does not match' };
        }
        const current = chainHash(prev, auditBody(r));
        if (current !== r.hash && legacyHash(prev, r) !== r.hash) {
          return { checked, ok: false, firstBrokenId: r.id.toString(), reason: 'Entry content does not match its hash' };
        }
        prev = r.hash;
      }
      cursor = batch[batch.length - 1]!.id;
    }
    return { checked, ok: true, firstBrokenId: null, reason: null };
  }
}

/**
 * v1 rows hashed the AuditEntry exactly as passed: absent fields were omitted,
 * explicit nulls kept. Storage cannot tell them apart, so each nullable
 * column is tried both ways (16 combinations at most).
 */
function legacyHash(prev: string | null, r: Parameters<typeof auditBody>[0]): string | null {
  const base: Record<string, unknown> = { actorType: r.actorType, action: r.action, entityType: r.entityType, entityId: r.entityId };
  if (r.before !== null && r.before !== undefined) base.before = r.before;
  if (r.after !== null && r.after !== undefined) base.after = r.after;
  const nullable = (['actorUserId', 'requestId', 'ipHash', 'userAgent'] as const).filter((k) => r[k] === null);
  for (const k of ['actorUserId', 'requestId', 'ipHash', 'userAgent'] as const) if (r[k] !== null) base[k] = r[k];
  const target = (r as { hash?: string }).hash;
  for (let mask = 0; mask < 1 << nullable.length; mask++) {
    const entry = { ...base };
    nullable.forEach((k, i) => {
      if (mask & (1 << i)) entry[k] = null;
    });
    const h = chainHash(prev, canonicalJson({ ...entry, occurredAt: r.occurredAt.toISOString() }));
    if (h === target) return h;
  }
  return null;
}
