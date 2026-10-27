import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@jpt/database';
import {
  allocateProRata,
  applyBps,
  DEFAULT_WITHHOLDING_BPS,
  type DistributionDetailDto,
  type DistributionSummaryDto,
  type ExpenseCategoryKey,
  expenseBucket,
  resolveModuleState,
  sumBig,
  toWire,
} from '@jpt/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../common/request-context';
import { Mailer } from '../mail/mailer.service';
import { ACCOUNTS, LedgerService } from '../payments/ledger.service';
import { PaymentProvider } from '../payments/payment-provider';
import { PrismaService } from '../prisma/prisma.service';

export interface PrepareInput {
  offeringId: string;
  periodStart: Date;
  periodEnd: Date;
  reserveAllocation: bigint;
  paymentDate?: Date;
}

const OPERATING_OFFERINGS = ['OPEN', 'FUNDED', 'CLOSED'] as const;
const day = (d: Date) => d.toISOString().slice(0, 10);

const distInclude = {
  offering: { include: { property: { select: { name: true } } } },
  allocations: { include: { user: { select: { email: true } } }, orderBy: { grossAmount: 'desc' } },
} satisfies Prisma.DistributionInclude;
type DistWithRelations = Prisma.DistributionGetPayload<{ include: typeof distInclude }>;

/**
 * Rental distributions: calculate from recorded income and expenses, freeze
 * holdings at the record date, split to the yen, approve with four eyes, pay
 * through the payment port, and post every yen to the ledger.
 *
 * The database independently enforces the formula, non-negative amounts,
 * allocations ≤ distributable and approver ≠ preparer.
 */
@Injectable()
export class DistributionsService {
  private readonly logger = new Logger(DistributionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly payments: PaymentProvider,
    private readonly mailer: Mailer,
  ) {}

  /** Income and expense totals for a period, bucketed for the formula. */
  async preview(offeringId: string, periodStart: Date, periodEnd: Date, reserveAllocation = 0n) {
    const offering = await this.prisma.tokenOffering.findUnique({ where: { id: offeringId } });
    if (!offering) throw new NotFoundException({ code: 'OFFERING_NOT_FOUND', message: 'Offering not found' });
    const [income, expenses] = await Promise.all([
      this.prisma.rentalIncome.aggregate({
        where: { propertyId: offering.propertyId, periodMonth: { gte: periodStart, lte: periodEnd } },
        _sum: { amount: true },
      }),
      this.prisma.propertyExpense.groupBy({
        by: ['category'],
        where: { propertyId: offering.propertyId, incurredAt: { gte: periodStart, lte: periodEnd } },
        _sum: { amount: true },
      }),
    ]);
    const buckets = { operatingExpenses: 0n, taxes: 0n, fees: 0n };
    for (const e of expenses) buckets[expenseBucket(e.category as ExpenseCategoryKey)] += e._sum.amount ?? 0n;
    const grossIncome = income._sum.amount ?? 0n;
    const distributableAmount = grossIncome - buckets.operatingExpenses - buckets.taxes - buckets.fees - reserveAllocation;
    return { offering, grossIncome, ...buckets, reserveAllocation, distributableAmount };
  }

  async prepare(auth: AuthContext, input: PrepareInput): Promise<DistributionDetailDto> {
    if (input.periodEnd < input.periodStart) {
      throw new UnprocessableEntityException({ code: 'PERIOD_INVALID', message: 'The period ends before it starts' });
    }
    if (input.periodEnd > new Date()) {
      throw new UnprocessableEntityException({ code: 'PERIOD_NOT_ENDED', message: 'Distributions are calculated for periods that have ended' });
    }
    const p = await this.preview(input.offeringId, input.periodStart, input.periodEnd, input.reserveAllocation);
    if (!(OPERATING_OFFERINGS as readonly string[]).includes(p.offering.status)) {
      throw new ConflictException({ code: 'OFFERING_NOT_OPERATING', message: 'Only open, funded or closed offerings distribute income' });
    }
    if (p.grossIncome === 0n) {
      throw new UnprocessableEntityException({ code: 'NO_INCOME', message: 'No rental income is recorded for this period' });
    }
    if (p.distributableAmount < 0n) {
      throw new UnprocessableEntityException({
        code: 'NEGATIVE_DISTRIBUTABLE',
        message: 'Expenses, taxes, fees and reserve exceed income for this period',
        details: { grossIncome: toWire(p.grossIncome), deductions: toWire(p.grossIncome - p.distributableAmount) },
      });
    }

    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const recordDate = new Date();
        const holdings = await tx.investment.findMany({
          where: { offeringId: p.offering.id, tokens: { gt: 0n } },
          orderBy: { firstInvestedAt: 'asc' },
        });
        if (!holdings.length) {
          throw new UnprocessableEntityException({ code: 'NO_HOLDERS', message: 'Nobody holds tokens of this offering yet' });
        }
        // Tokens sold but not linked to platform accounts (the DEMO supply)
        // keep their pro-rata share; it is reported, never paid to someone else.
        const registered = sumBig(holdings.map((h) => h.tokens));
        const offering = await tx.tokenOffering.findUniqueOrThrow({ where: { id: p.offering.id } });
        const outstanding = offering.tokensSold > registered ? offering.tokensSold : registered;
        const shares = allocateProRata(p.distributableAmount, [...holdings.map((h) => h.tokens), outstanding - registered]);

        const dist = await tx.distribution.create({
          data: {
            offeringId: offering.id,
            isDemo: offering.isDemo,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            status: 'CALCULATED',
            grossIncome: p.grossIncome,
            operatingExpenses: p.operatingExpenses,
            taxes: p.taxes,
            reserveAllocation: p.reserveAllocation,
            fees: p.fees,
            distributableAmount: p.distributableAmount,
            recordDate,
            paymentDate: input.paymentDate ?? null,
            preparedById: auth.userId,
          },
        });
        const rows = holdings
          .map((h, i) => {
            const gross = shares[i]!;
            const withholdingTax = applyBps(gross, DEFAULT_WITHHOLDING_BPS, 'floor');
            return {
              distributionId: dist.id,
              userId: h.userId,
              investmentId: h.id,
              tokensAtRecord: h.tokens,
              grossAmount: gross,
              withholdingTaxBps: DEFAULT_WITHHOLDING_BPS,
              withholdingTax,
              netAmount: gross - withholdingTax,
            };
          })
          .filter((r) => r.grossAmount > 0n);
        if (rows.length) await tx.distributionAllocation.createMany({ data: rows });
        await this.audit.record(tx, {
          actorType: 'USER',
          actorUserId: auth.userId,
          action: 'distribution.calculated',
          entityType: 'Distribution',
          entityId: dist.id,
          after: {
            offeringId: offering.id,
            period: `${day(input.periodStart)}..${day(input.periodEnd)}`,
            distributableAmount: p.distributableAmount,
            holders: rows.length,
            allocated: sumBig(rows.map((r) => r.grossAmount)),
          },
        });
        return dist.id;
      });
      return this.get(id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: 'DUPLICATE_PERIOD', message: 'A distribution for this offering and period already exists' });
      }
      throw e;
    }
  }

  async approve(auth: AuthContext, id: string): Promise<DistributionDetailDto> {
    const dist = await this.prisma.distribution.findUnique({ where: { id } });
    if (!dist) throw new NotFoundException({ code: 'DISTRIBUTION_NOT_FOUND', message: 'Distribution not found' });
    if (dist.preparedById === auth.userId) {
      throw new ForbiddenException({ code: 'FOUR_EYES', message: 'A distribution must be approved by someone other than who prepared it' });
    }
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const moved = await tx.distribution.updateMany({
        where: { id, status: 'CALCULATED' },
        data: { status: 'APPROVED', approvedById: auth.userId, approvedAt: now },
      });
      if (moved.count !== 1) throw new ConflictException({ code: 'INVALID_STATE', message: `Distribution is ${dist.status}, not awaiting approval` });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: auth.userId,
        action: 'distribution.approved',
        entityType: 'Distribution',
        entityId: id,
        before: { status: dist.status },
        after: { status: 'APPROVED' },
      });
    });
    return this.get(id);
  }

  async cancel(auth: AuthContext, id: string, reason: string): Promise<DistributionDetailDto> {
    const dist = await this.prisma.distribution.findUnique({ where: { id } });
    if (!dist) throw new NotFoundException({ code: 'DISTRIBUTION_NOT_FOUND', message: 'Distribution not found' });
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.distribution.updateMany({ where: { id, status: { in: ['CALCULATED', 'APPROVED'] } }, data: { status: 'CANCELLED' } });
      if (moved.count !== 1) throw new ConflictException({ code: 'INVALID_STATE', message: `A ${dist.status} distribution cannot be cancelled` });
      await tx.distributionAllocation.updateMany({ where: { distributionId: id, status: 'PENDING' }, data: { status: 'HELD', holdReason: 'Distribution cancelled' } });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: auth.userId,
        action: 'distribution.cancelled',
        entityType: 'Distribution',
        entityId: id,
        before: { status: dist.status },
        after: { status: 'CANCELLED', reason },
      });
    });
    return this.get(id);
  }

  /**
   * Pays every pending allocation. Re-runnable: a failed payout leaves the
   * distribution in PAYING and only unpaid allocations are retried.
   */
  async pay(auth: AuthContext, id: string): Promise<DistributionDetailDto> {
    const dist = await this.prisma.distribution.findUnique({ where: { id }, include: { offering: true } });
    if (!dist) throw new NotFoundException({ code: 'DISTRIBUTION_NOT_FOUND', message: 'Distribution not found' });
    if (!dist.offering.isDemo && !resolveModuleState('RENT_DISTRIBUTIONS', process.env).enabled) {
      throw new ForbiddenException({ code: 'RENT_DISTRIBUTIONS_DISABLED', message: 'Paying real distributions is not enabled' });
    }
    const symbol = dist.offering.tokenSymbol;
    const payable = ACCOUNTS.distributionsPayable(dist.offeringId, symbol);

    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.distribution.updateMany({ where: { id, status: { in: ['APPROVED', 'PAYING'] } }, data: { status: 'PAYING' } });
      if (moved.count !== 1) throw new ConflictException({ code: 'INVALID_STATE', message: `A ${dist.status} distribution cannot be paid` });
      const allocated = await tx.distributionAllocation.aggregate({ where: { distributionId: id }, _sum: { grossAmount: true } });
      const total = allocated._sum.grossAmount ?? 0n;
      // Issuer funds arrive in client money and become owed to holders (idempotent key).
      if (total > 0n) {
        await this.ledger.post(tx, `distribution:${id}:funded`, `Distribution funding ${symbol} ${day(dist.periodStart)}..${day(dist.periodEnd)}`, [
          { account: ACCOUNTS.clientMoney, amount: total },
          { account: payable, amount: -total },
        ]);
      }
      if (dist.status === 'APPROVED') {
        await this.audit.record(tx, {
          actorType: 'USER',
          actorUserId: auth.userId,
          action: 'distribution.payment_started',
          entityType: 'Distribution',
          entityId: id,
          after: { allocated: total },
        });
      }
    });

    const pending = await this.prisma.distributionAllocation.findMany({
      where: { distributionId: id, status: { in: ['PENDING', 'FAILED'] } },
      include: { user: { select: { email: true } } },
    });
    for (const a of pending) {
      const reference = `DIST-${id.slice(0, 8)}-${a.id.slice(0, 8)}`.toUpperCase();
      const idempotencyKey = `dist:${a.id}`;
      const result = await this.payments.payout({ idempotencyKey, amount: a.netAmount, reference });
      await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const payment = await tx.payment.upsert({
          where: { idempotencyKey },
          create: {
            direction: 'OUTBOUND',
            purpose: 'DISTRIBUTION',
            provider: this.payments.key,
            providerReference: result.providerReference,
            status: result.status,
            amount: a.netAmount,
            idempotencyKey,
            failureCode: result.failureCode ?? null,
            settledAt: result.status === 'SUCCEEDED' ? now : null,
          },
          update: { status: result.status, failureCode: result.failureCode ?? null, settledAt: result.status === 'SUCCEEDED' ? now : null },
        });
        if (result.status === 'FAILED') {
          await tx.distributionAllocation.update({ where: { id: a.id }, data: { status: 'FAILED', paymentId: payment.id } });
          return;
        }
        await tx.distributionAllocation.update({ where: { id: a.id }, data: { status: 'PAID', paymentId: payment.id, paidAt: now } });
        await this.ledger.post(tx, `distribution_allocation:${a.id}:paid`, `Distribution ${reference}`, [
          { account: payable, amount: a.grossAmount },
          { account: ACCOUNTS.clientMoney, amount: -a.netAmount },
          { account: ACCOUNTS.withholdingTaxPayable, amount: -a.withholdingTax },
        ]);
        await tx.transaction.create({
          data: {
            userId: a.userId,
            offeringId: dist.offeringId,
            type: 'DISTRIBUTION',
            status: 'COMPLETED',
            amount: a.netAmount,
            tokens: a.tokensAtRecord,
            reference,
            paymentId: payment.id,
            distributionAllocationId: a.id,
            occurredAt: now,
          },
        });
      });
      if (result.status === 'SUCCEEDED') {
        await this.mailer
          .send({
            userId: a.userId,
            to: a.user.email,
            type: 'distribution.paid',
            subject: `Distribution ${symbol} ${day(dist.periodStart)} – ${day(dist.periodEnd)}`,
            text: `${dist.isDemo ? 'SIMULATED: ' : ''}We paid ¥${a.netAmount} for ${a.tokensAtRecord} tokens of ${symbol} (gross ¥${a.grossAmount}, withholding tax ¥${a.withholdingTax}).`,
            data: { reference },
          })
          .catch((e: unknown) => this.logger.warn(`distribution email failed: ${String(e)}`));
      }
    }

    const left = await this.prisma.distributionAllocation.count({ where: { distributionId: id, status: { in: ['PENDING', 'FAILED'] } } });
    if (left === 0) {
      await this.prisma.$transaction(async (tx) => {
        const done = await tx.distribution.updateMany({ where: { id, status: 'PAYING' }, data: { status: 'PAID', paidAt: new Date() } });
        if (done.count === 1) {
          await this.audit.record(tx, {
            actorType: 'USER',
            actorUserId: auth.userId,
            action: 'distribution.paid',
            entityType: 'Distribution',
            entityId: id,
            after: { status: 'PAID' },
          });
        }
      });
    }
    return this.get(id);
  }

  async list(): Promise<DistributionSummaryDto[]> {
    const rows = await this.prisma.distribution.findMany({ include: distInclude, orderBy: [{ createdAt: 'desc' }], take: 200 });
    const emails = await this.staffEmails(rows);
    return rows.map((d) => this.summary(d, emails));
  }

  async get(id: string): Promise<DistributionDetailDto> {
    const d = await this.prisma.distribution.findUnique({ where: { id }, include: distInclude });
    if (!d) throw new NotFoundException({ code: 'DISTRIBUTION_NOT_FOUND', message: 'Distribution not found' });
    const emails = await this.staffEmails([d]);
    const summary = this.summary(d, emails);
    return {
      ...summary,
      unallocatedAmount: toWire(d.distributableAmount - BigInt(summary.allocatedAmount)),
      allocations: d.allocations.map((a) => ({
        id: a.id,
        email: a.user.email,
        tokensAtRecord: toWire(a.tokensAtRecord),
        grossAmount: toWire(a.grossAmount),
        withholdingTaxBps: a.withholdingTaxBps,
        withholdingTax: toWire(a.withholdingTax),
        netAmount: toWire(a.netAmount),
        status: a.status,
        holdReason: a.holdReason,
        paidAt: a.paidAt?.toISOString() ?? null,
      })),
    };
  }

  private async staffEmails(rows: DistWithRelations[]): Promise<Map<string, string>> {
    const ids = [...new Set(rows.flatMap((r) => [r.preparedById, r.approvedById]).filter((x): x is string => !!x))];
    const users = ids.length ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } }) : [];
    return new Map(users.map((u) => [u.id, u.email]));
  }

  private summary(d: DistWithRelations, emails: Map<string, string>): DistributionSummaryDto {
    return {
      id: d.id,
      offeringId: d.offeringId,
      tokenSymbol: d.offering.tokenSymbol,
      propertyName: d.offering.property.name,
      isDemo: d.isDemo,
      status: d.status,
      periodStart: day(d.periodStart),
      periodEnd: day(d.periodEnd),
      grossIncome: toWire(d.grossIncome),
      operatingExpenses: toWire(d.operatingExpenses),
      taxes: toWire(d.taxes),
      reserveAllocation: toWire(d.reserveAllocation),
      fees: toWire(d.fees),
      distributableAmount: toWire(d.distributableAmount),
      allocatedAmount: toWire(sumBig(d.allocations.map((a) => a.grossAmount))),
      recordDate: d.recordDate?.toISOString() ?? null,
      preparedBy: d.preparedById ? (emails.get(d.preparedById) ?? null) : null,
      approvedBy: d.approvedById ? (emails.get(d.approvedById) ?? null) : null,
      approvedAt: d.approvedAt?.toISOString() ?? null,
      paidAt: d.paidAt?.toISOString() ?? null,
      holders: d.allocations.length,
    };
  }
}
