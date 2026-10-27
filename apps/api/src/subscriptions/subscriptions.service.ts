import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type SubscriptionOrder } from '@jpt/database';
import { resolveModuleState, simulateInvestment, toWire } from '@jpt/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../common/request-context';
import { Mailer } from '../mail/mailer.service';
import { ACCOUNTS, LedgerService } from '../payments/ledger.service';
import { type PaymentInstructions, PaymentProvider } from '../payments/payment-provider';
import { PrismaService } from '../prisma/prisma.service';

export const ORDER_TTL_MINUTES = 30;
const REQUIRED_DOCUMENT_TYPES = ['LEGAL_STRUCTURE', 'RISK_DISCLOSURE', 'INVESTMENT_CONTRACT', 'ISSUANCE_DOCUMENT'] as const;
const OPEN_STATES = ['PENDING_DOCUMENTS', 'AWAITING_PAYMENT'] as const;

export interface OrderDto {
  id: string;
  reference: string;
  status: SubscriptionOrder['status'];
  isSimulated: boolean;
  property: { slug: string; name: string };
  tokenSymbol: string;
  tokens: string;
  tokenPrice: string;
  amount: string;
  feeAmount: string;
  totalAmount: string;
  currency: string;
  expiresAt: string | null;
  createdAt: string;
  requiredDocuments: Array<{ id: string; type: string; title: string; sha256: string; accepted: boolean }>;
  payment: { id: string; status: string; instructions: PaymentInstructions | null } | null;
  allocation: { status: string; tokens: string; note: string } | null;
}

@Injectable()
export class SubscriptionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionsService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentProvider,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly mailer: Mailer,
  ) {}

  onModuleInit() {
    // Lightweight scheduler until BullMQ workers land (Phase 5).
    if (process.env.NODE_ENV !== 'test') {
      this.timer = setInterval(() => void this.expireStale().catch((e) => this.logger.error(e)), 60_000);
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /* Create ---------------------------------------------------------------- */

  async create(auth: AuthContext, input: { propertySlug: string; amount: bigint }, idempotencyKey: string | undefined): Promise<OrderDto> {
    if (!idempotencyKey || !/^[\w-]{8,80}$/.test(idempotencyKey)) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Send a unique Idempotency-Key header (8–80 characters)' });
    }
    const previous = await this.prisma.subscriptionOrder.findUnique({
      where: { userId_idempotencyKey: { userId: auth.userId, idempotencyKey } },
      include: { offering: { include: { property: true } } },
    });
    if (previous) {
      const sameRequest =
        previous.offering.property.slug === input.propertySlug &&
        input.amount >= previous.amount &&
        input.amount - previous.amount < previous.tokenPrice;
      if (!sameRequest) {
        throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED', message: 'This Idempotency-Key was already used for a different request' });
      }
      return this.get(auth, previous.id);
    }
    if (!resolveModuleState('SIMULATED_SUBSCRIPTIONS', process.env).enabled) {
      throw new ForbiddenException({ code: 'MODULE_DISABLED', message: 'Subscriptions are disabled in this environment' });
    }
    await this.expireStale();

    const eligibility = await this.currentEligibility(auth.userId);
    if (!eligibility.simulatedAllowed) {
      throw new ForbiddenException({ code: 'NOT_ELIGIBLE', message: 'Complete identity verification before investing' });
    }

    const property = await this.prisma.property.findFirst({
      where: { slug: input.propertySlug, status: 'PUBLISHED' },
      include: {
        financials: { where: { isCurrent: true }, take: 1 },
        offerings: { where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const offering = property?.offerings[0];
    const financial = property?.financials[0];
    if (!property || !offering || !financial) {
      throw new UnprocessableEntityException({ code: 'OFFERING_NOT_OPEN', message: 'This property has no round open for subscriptions' });
    }
    const now = new Date();
    if ((offering.opensAt && offering.opensAt > now) || (offering.closesAt && offering.closesAt <= now)) {
      throw new UnprocessableEntityException({ code: 'OFFERING_NOT_OPEN', message: 'The subscription window for this round is closed' });
    }
    if (!offering.isDemo) {
      const real = resolveModuleState('REAL_SUBSCRIPTIONS', process.env).enabled;
      if (!real || !eligibility.realAllowed || !offering.legalApprovalRef) {
        throw new ForbiddenException({ code: 'REAL_SUBSCRIPTIONS_DISABLED', message: 'Real-money subscriptions are not available' });
      }
    }

    const sim = simulateInvestment({
      financials: {
        purchasePrice: financial.purchasePrice,
        acquisitionCosts: financial.acquisitionCosts,
        renovationCosts: financial.renovationCosts,
        reserves: financial.reserves,
        annualGrossRent: financial.annualGrossRent,
        occupancyBps: financial.occupancyBps,
        annualOperatingExpenses: financial.annualOperatingExpenses,
        annualPropertyTax: financial.annualPropertyTax,
        propertyManagementFeeBps: financial.propertyManagementFeeBps,
        platformFeeBps: financial.platformFeeBps,
        subscriptionFeeBps: financial.subscriptionFeeBps,
        totalTokens: offering.totalTokens,
      },
      tokensSold: offering.tokensSold + offering.tokensReserved,
      amount: input.amount,
      minimumInvestment: offering.minimumInvestment,
      maximumInvestment: offering.maximumInvestment,
    });
    if (!sim.eligibleAmount || sim.tokens === 0n) {
      throw new UnprocessableEntityException({ code: 'AMOUNT_NOT_ALLOWED', message: 'This amount cannot be subscribed', details: sim.issues });
    }
    if (sim.tokenPrice !== offering.tokenPrice) throw new Error(`Token price mismatch for offering ${offering.id}`);

    // Per-investor cap counts current holdings and open orders, not just this one.
    if (offering.maximumInvestment !== null) {
      const [held, open] = await Promise.all([
        this.prisma.investment.findUnique({ where: { userId_offeringId: { userId: auth.userId, offeringId: offering.id } } }),
        this.prisma.subscriptionOrder.aggregate({
          where: { userId: auth.userId, offeringId: offering.id, status: { in: [...OPEN_STATES, 'PAYMENT_RECEIVED', 'COMPLIANCE_CHECK', 'ALLOCATING'] } },
          _sum: { amount: true },
        }),
      ]);
      const exposure = (held?.investedAmount ?? 0n) + (open._sum.amount ?? 0n) + sim.investedAmount;
      if (exposure > offering.maximumInvestment) {
        throw new UnprocessableEntityException({ code: 'ABOVE_INVESTOR_LIMIT', message: 'This would exceed the maximum you can hold in this offering' });
      }
    }

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        // Atomic reservation: succeeds only if supply remains. The CHECK
        // constraint is the backstop if this ever regresses.
        const reserved = await tx.$executeRaw`
          UPDATE "token_offerings"
             SET "tokensReserved" = "tokensReserved" + ${sim.tokens}, "updatedAt" = now()
           WHERE "id" = ${offering.id}::uuid AND "status" = 'OPEN'
             AND "tokensSold" + "tokensReserved" + ${sim.tokens} <= "totalTokens"`;
        if (reserved !== 1) {
          throw new ConflictException({ code: 'INSUFFICIENT_TOKENS', message: 'Not enough tokens remain in this round for that amount' });
        }
        const created = await tx.subscriptionOrder.create({
          data: {
            reference: `JPT-${now.getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`,
            userId: auth.userId,
            offeringId: offering.id,
            status: 'PENDING_DOCUMENTS',
            tokens: sim.tokens,
            tokenPrice: sim.tokenPrice,
            amount: sim.investedAmount,
            feeAmount: sim.subscriptionFee,
            totalAmount: sim.totalPayable,
            idempotencyKey,
            isSimulated: offering.isDemo,
            eligibilitySnapshot: { ...eligibility, assessedAt: now.toISOString() } as Prisma.InputJsonValue,
            expiresAt: new Date(now.getTime() + ORDER_TTL_MINUTES * 60_000),
          },
        });
        await this.audit.record(tx, {
          actorType: 'USER',
          actorUserId: auth.userId,
          action: 'subscription.created',
          entityType: 'SubscriptionOrder',
          entityId: created.id,
          after: { tokens: sim.tokens, amount: sim.investedAmount, fee: sim.subscriptionFee, offering: offering.tokenSymbol },
        });
        return created;
      });
      return this.get(auth, order.id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // Concurrent retry with the same key: return the order that won.
        const winner = await this.prisma.subscriptionOrder.findUnique({
          where: { userId_idempotencyKey: { userId: auth.userId, idempotencyKey } },
        });
        if (winner) return this.get(auth, winner.id);
      }
      throw e;
    }
  }

  /* Read ------------------------------------------------------------------- */

  async get(auth: AuthContext, id: string): Promise<OrderDto> {
    const order = await this.prisma.subscriptionOrder.findUnique({
      where: { id },
      include: {
        offering: {
          include: {
            property: { select: { slug: true, name: true } },
            documents: { where: { type: { in: [...REQUIRED_DOCUMENT_TYPES] }, publishedAt: { not: null } }, orderBy: { version: 'desc' } },
          },
        },
        documentAcceptances: true,
        payments: { where: { purpose: 'SUBSCRIPTION' }, orderBy: { createdAt: 'desc' }, take: 1, include: { events: { where: { type: 'INTENT_CREATED' }, take: 1 } } },
        allocation: true,
      },
    });
    // Same 404 for "not yours" and "does not exist".
    if (!order || order.userId !== auth.userId) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    const accepted = new Set(order.documentAcceptances.map((a) => a.documentId));
    const latestByType = new Map<string, (typeof order.offering.documents)[number]>();
    for (const d of order.offering.documents) if (!latestByType.has(d.type)) latestByType.set(d.type, d);
    const payment = order.payments[0];
    const intentPayload = payment?.events[0]?.payload as { instructions?: PaymentInstructions } | undefined;
    return {
      id: order.id,
      reference: order.reference,
      status: order.status,
      isSimulated: order.isSimulated,
      property: order.offering.property,
      tokenSymbol: order.offering.tokenSymbol,
      tokens: toWire(order.tokens),
      tokenPrice: toWire(order.tokenPrice),
      amount: toWire(order.amount),
      feeAmount: toWire(order.feeAmount),
      totalAmount: toWire(order.totalAmount),
      currency: order.currency,
      expiresAt: order.expiresAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      requiredDocuments: [...latestByType.values()].map((d) => ({ id: d.id, type: d.type, title: d.title, sha256: d.sha256, accepted: accepted.has(d.id) })),
      payment: payment ? { id: payment.id, status: payment.status, instructions: intentPayload?.instructions ?? null } : null,
      allocation: order.allocation
        ? {
            status: order.allocation.status,
            tokens: toWire(order.allocation.tokens),
            note: order.allocation.status === 'PENDING' ? 'Recorded in the investor register; on-chain issuance follows in Phase 4.' : '',
          }
        : null,
    };
  }

  async list(auth: AuthContext) {
    const orders = await this.prisma.subscriptionOrder.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true },
    });
    return Promise.all(orders.map((o) => this.get(auth, o.id)));
  }

  /* Documents & payment intent ---------------------------------------------- */

  async acceptDocuments(auth: AuthContext, id: string, documentIds: string[]): Promise<OrderDto> {
    const dto = await this.get(auth, id);
    if (dto.status !== 'PENDING_DOCUMENTS') {
      throw new ConflictException({ code: 'ORDER_STATE', message: `Documents can only be accepted before payment (order is ${dto.status})` });
    }
    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date()) {
      await this.expireStale();
      throw new ConflictException({ code: 'ORDER_EXPIRED', message: 'This order has expired. Start a new one.' });
    }
    const missing = dto.requiredDocuments.filter((d) => !documentIds.includes(d.id));
    if (missing.length || dto.requiredDocuments.length < REQUIRED_DOCUMENT_TYPES.length) {
      throw new BadRequestException({
        code: 'DOCUMENTS_REQUIRED',
        message: 'Read and accept every required document',
        details: missing.map((d) => d.type),
      });
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const moved = await tx.subscriptionOrder.updateMany({
        where: { id, status: 'PENDING_DOCUMENTS' },
        data: { status: 'AWAITING_PAYMENT', documentsAcceptedAt: new Date() },
      });
      if (moved.count !== 1) throw new ConflictException({ code: 'ORDER_STATE', message: 'Order changed; reload and try again' });
      await tx.orderDocumentAcceptance.createMany({
        data: dto.requiredDocuments.map((d) => ({ orderId: id, documentId: d.id, sha256: d.sha256 })),
        skipDuplicates: true,
      });
      const p = await tx.payment.create({
        data: {
          orderId: id,
          direction: 'INBOUND',
          purpose: 'SUBSCRIPTION',
          provider: this.payments.key,
          status: 'CREATED',
          amount: BigInt(dto.totalAmount),
          idempotencyKey: `order:${id}:subscription`,
        },
      });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: auth.userId,
        action: 'subscription.documents_accepted',
        entityType: 'SubscriptionOrder',
        entityId: id,
        after: { documents: dto.requiredDocuments.map((d) => ({ type: d.type, sha256: d.sha256 })) },
      });
      return p;
    });

    const intent = await this.payments.createIntent({ paymentId: payment.id, amount: payment.amount, reference: dto.reference });
    await this.prisma.$transaction([
      this.prisma.payment.update({ where: { id: payment.id }, data: { providerReference: intent.providerReference, status: 'PENDING' } }),
      this.prisma.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          type: 'INTENT_CREATED',
          amount: payment.amount,
          signatureVerified: false,
          payload: { instructions: intent.instructions } as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);
    return this.get(auth, id);
  }

  /* Cancel / expire ----------------------------------------------------------- */

  async cancel(auth: AuthContext, id: string): Promise<OrderDto> {
    const dto = await this.get(auth, id);
    const done = await this.release(id, 'CANCELLED', 'Cancelled by investor', auth.userId);
    if (!done) throw new ConflictException({ code: 'ORDER_STATE', message: `This order can no longer be cancelled (it is ${dto.status})` });
    return this.get(auth, id);
  }

  async expireStale(): Promise<number> {
    const stale = await this.prisma.subscriptionOrder.findMany({
      where: { status: { in: [...OPEN_STATES] }, expiresAt: { lte: new Date() } },
      select: { id: true },
      take: 200,
    });
    let n = 0;
    for (const o of stale) if (await this.release(o.id, 'EXPIRED', 'Payment window elapsed', null)) n++;
    return n;
  }

  /** Moves an open order to a terminal state and returns its tokens to the round. */
  private async release(id: string, to: 'CANCELLED' | 'EXPIRED', reason: string, actorUserId: string | null): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.subscriptionOrder.findUnique({ where: { id } });
      if (!order) return false;
      const moved = await tx.subscriptionOrder.updateMany({
        where: { id, status: { in: [...OPEN_STATES] } },
        data: { status: to, cancelledAt: new Date(), cancelReason: reason },
      });
      if (moved.count !== 1) return false;
      await tx.$executeRaw`UPDATE "token_offerings" SET "tokensReserved" = "tokensReserved" - ${order.tokens}, "updatedAt" = now() WHERE "id" = ${order.offeringId}::uuid`;
      await tx.payment.updateMany({ where: { orderId: id, status: { in: ['CREATED', 'PENDING'] } }, data: { status: 'CANCELLED' } });
      await this.audit.record(tx, {
        actorType: actorUserId ? 'USER' : 'SYSTEM',
        actorUserId,
        action: `subscription.${to.toLowerCase()}`,
        entityType: 'SubscriptionOrder',
        entityId: id,
        after: { reason, tokensReleased: order.tokens },
      });
      return true;
    });
  }

  /* Payment webhook ------------------------------------------------------------ */

  async handlePaymentWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<{ status: string }> {
    const event = this.payments.parseWebhook(rawBody, signature);
    let webhookId: string;
    try {
      webhookId = (
        await this.prisma.inboundWebhook.create({
          data: {
            provider: `payments:${this.payments.key}`,
            eventId: event.eventId,
            eventType: event.type,
            signatureVerified: true,
            payload: { ...event, amount: event.amount.toString() } as Prisma.InputJsonValue,
          },
        })
      ).id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { status: 'duplicate' };
      throw e;
    }
    const finish = (status: 'PROCESSED' | 'REJECTED', error?: string) =>
      this.prisma.inboundWebhook.update({ where: { id: webhookId }, data: { status, error: error ?? null, processedAt: new Date() } });

    const payment = await this.prisma.payment.findUnique({
      where: { provider_providerReference: { provider: this.payments.key, providerReference: event.providerReference } },
    });
    if (!payment || !payment.orderId) {
      await finish('REJECTED', 'Unknown payment reference');
      return { status: 'ignored' };
    }
    const eventRow = {
      paymentId: payment.id,
      providerEventId: event.eventId,
      webhookId,
      amount: event.amount,
      signatureVerified: true,
      payload: { ...event, amount: event.amount.toString() } as Prisma.InputJsonValue,
    };

    if (event.type === 'payment.failed') {
      await this.prisma.$transaction([
        this.prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED', failureCode: event.failureCode ?? 'failed' } }),
        this.prisma.paymentTransaction.create({ data: { ...eventRow, type: 'FAILED' } }),
      ]);
      await finish('PROCESSED');
      return { status: 'payment_failed' };
    }

    if (payment.status === 'SUCCEEDED' || payment.status === 'REFUNDED') {
      await this.prisma.paymentTransaction.create({ data: { ...eventRow, type: 'WEBHOOK_RECEIVED' } });
      await finish('PROCESSED', 'Payment already settled');
      return { status: 'already_settled' };
    }

    // Money has arrived: record it before deciding what to do with the order.
    const outcome = await this.prisma.$transaction(async (tx) => {
      // Row lock: a concurrent cancel/expiry cannot interleave with settlement.
      await tx.$executeRaw`SELECT 1 FROM "subscription_orders" WHERE "id" = ${payment.orderId}::uuid FOR UPDATE`;
      const order = await tx.subscriptionOrder.findUniqueOrThrow({
        where: { id: payment.orderId! },
        include: { offering: true, user: true },
      });
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED', settledAt: new Date() } });
      await tx.paymentTransaction.create({ data: { ...eventRow, type: 'CAPTURED' } });
      const payable = ACCOUNTS.subscriptionsPayable(order.offeringId, order.offering.tokenSymbol);
      await this.ledger.post(tx, `payment:${payment.id}:captured`, `Subscription payment ${order.reference}`, [
        { account: ACCOUNTS.clientMoney, amount: event.amount },
        { account: payable, amount: -(event.amount - order.feeAmount) },
        { account: ACCOUNTS.subscriptionFees, amount: -order.feeAmount },
      ]);

      const fresh = await tx.subscriptionOrder.findUniqueOrThrow({ where: { id: order.id } });
      let refundReason: string | null = null;
      if (fresh.status !== 'AWAITING_PAYMENT') refundReason = `Order is ${fresh.status}`;
      else if (event.amount !== order.totalAmount) refundReason = `Amount mismatch: received ${event.amount}, expected ${order.totalAmount}`;
      else {
        const eligibility = await this.currentEligibility(order.userId, tx);
        if (!eligibility.simulatedAllowed) refundReason = 'Investor no longer eligible at settlement';
      }

      if (refundReason) {
        // Orders still holding a reservation release it; terminal ones already did.
        if (fresh.status === 'AWAITING_PAYMENT') {
          await tx.subscriptionOrder.update({ where: { id: order.id }, data: { status: 'REFUND_PENDING', cancelReason: refundReason } });
          await tx.$executeRaw`UPDATE "token_offerings" SET "tokensReserved" = "tokensReserved" - ${order.tokens}, "updatedAt" = now() WHERE "id" = ${order.offeringId}::uuid`;
        }
        await this.audit.record(tx, {
          actorType: 'WEBHOOK',
          action: 'subscription.payment_rejected',
          entityType: 'SubscriptionOrder',
          entityId: order.id,
          after: { reason: refundReason, paymentId: payment.id },
        });
        return { kind: 'refund' as const, order, reason: refundReason, moveOrder: fresh.status === 'AWAITING_PAYMENT' };
      }

      // Allocate: register economic holding; tokens reserved → sold.
      await tx.subscriptionOrder.update({ where: { id: order.id }, data: { status: 'ALLOCATED' } });
      await tx.$executeRaw`
        UPDATE "token_offerings"
           SET "tokensReserved" = "tokensReserved" - ${order.tokens},
               "tokensSold" = "tokensSold" + ${order.tokens},
               "status" = CASE WHEN "tokensSold" + ${order.tokens} = "totalTokens" THEN 'FUNDED'::"OfferingStatus" ELSE "status" END,
               "updatedAt" = now()
         WHERE "id" = ${order.offeringId}::uuid`;
      await tx.tokenAllocation.create({
        data: { orderId: order.id, offeringId: order.offeringId, userId: order.userId, tokens: order.tokens, status: 'PENDING' },
      });
      const now = new Date();
      await tx.investment.upsert({
        where: { userId_offeringId: { userId: order.userId, offeringId: order.offeringId } },
        create: { userId: order.userId, offeringId: order.offeringId, tokens: order.tokens, investedAmount: order.amount, firstInvestedAt: now },
        update: { tokens: { increment: order.tokens }, investedAmount: { increment: order.amount } },
      });
      await tx.transaction.createMany({
        data: [
          { userId: order.userId, offeringId: order.offeringId, type: 'PAYMENT', status: 'COMPLETED', amount: order.totalAmount, reference: `${order.reference}-PAY`, orderId: order.id, paymentId: payment.id, occurredAt: now },
          { userId: order.userId, offeringId: order.offeringId, type: 'SUBSCRIPTION', status: 'COMPLETED', amount: order.amount, tokens: order.tokens, reference: order.reference, orderId: order.id, occurredAt: now },
        ],
      });
      await this.audit.record(tx, {
        actorType: 'WEBHOOK',
        action: 'subscription.allocated',
        entityType: 'SubscriptionOrder',
        entityId: order.id,
        after: { tokens: order.tokens, amount: order.amount, paymentId: payment.id },
      });
      return { kind: 'allocated' as const, order };
    });

    if (outcome.kind === 'refund') {
      await this.refund(payment.id, outcome.order.id, outcome.reason, outcome.moveOrder);
      await finish('PROCESSED', outcome.reason);
      return { status: 'refunded' };
    }
    await finish('PROCESSED');
    await this.mailer.send({
      userId: outcome.order.userId,
      to: outcome.order.user.email,
      type: 'subscription.receipt',
      subject: `Receipt ${outcome.order.reference}`,
      text: `Your ${outcome.order.isSimulated ? 'SIMULATED ' : ''}subscription of ${outcome.order.tokens} tokens of ${outcome.order.offering.tokenSymbol} for ¥${outcome.order.totalAmount} (incl. fee ¥${outcome.order.feeAmount}) is confirmed.`,
      data: { reference: outcome.order.reference },
    });
    return { status: 'allocated' };
  }

  private async refund(paymentId: string, orderId: string, reason: string, moveOrder: boolean) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: { include: { offering: true } } } });
    const { refundReference } = await this.payments.refund({ providerReference: payment.providerReference!, amount: payment.amount });
    const order = payment.order!;
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED', refundedAmount: payment.amount } });
      await tx.paymentTransaction.create({
        data: { paymentId, type: 'REFUND_ISSUED', providerEventId: refundReference, amount: payment.amount, signatureVerified: false, payload: { reason } },
      });
      await this.ledger.post(tx, `payment:${paymentId}:refunded`, `Refund ${order.reference}`, [
        { account: ACCOUNTS.clientMoney, amount: -payment.amount },
        { account: ACCOUNTS.subscriptionsPayable(order.offeringId, order.offering.tokenSymbol), amount: payment.amount - order.feeAmount },
        { account: ACCOUNTS.subscriptionFees, amount: order.feeAmount },
      ]);
      if (moveOrder) await tx.subscriptionOrder.update({ where: { id: orderId }, data: { status: 'REFUNDED' } });
      await tx.transaction.create({
        data: {
          userId: order.userId,
          offeringId: order.offeringId,
          type: 'REFUND',
          status: 'COMPLETED',
          amount: payment.amount,
          reference: `${order.reference}-REF-${refundReference.slice(-6)}`,
          orderId,
          paymentId,
          occurredAt: new Date(),
        },
      });
      await this.audit.record(tx, {
        actorType: 'SYSTEM',
        action: 'payment.refunded',
        entityType: 'Payment',
        entityId: paymentId,
        after: { reason, amount: payment.amount, refundReference },
      });
    });
  }

  /* Eligibility ------------------------------------------------------------------ */

  private async currentEligibility(userId: string, db: Prisma.TransactionClient = this.prisma) {
    const [kyc, eligibility] = await Promise.all([
      db.kycVerification.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      db.investorEligibility.findFirst({ where: { userId }, orderBy: { assessedAt: 'desc' } }),
    ]);
    const now = new Date();
    const kycOk = kyc?.status === 'APPROVED' && !!kyc.expiresAt && kyc.expiresAt > now;
    const rules = (eligibility?.ruleResults ?? {}) as { simulatedAllowed?: boolean; realAllowed?: boolean };
    const valid = !!eligibility && (!eligibility.validUntil || eligibility.validUntil > now);
    return {
      kycStatus: kyc?.status ?? 'NOT_STARTED',
      simulatedAllowed: kycOk && valid && !!rules.simulatedAllowed,
      realAllowed: kycOk && valid && !!rules.realAllowed,
      ruleSetVersion: eligibility?.ruleSetVersion ?? null,
      jurisdiction: eligibility?.jurisdiction ?? null,
    };
  }
}
