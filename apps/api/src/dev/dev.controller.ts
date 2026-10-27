import { Body, Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { stableId } from '@jpt/database';
import { emailSchema, STAFF_ROLES } from '@jpt/shared';
import { AuditService } from '../audit/audit.service';
import { z } from 'zod';
import { CurrentAuth, Public } from '../auth/decorators';
import type { AuthContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SimulatedChainGateway } from '../chain/simulated-chain.gateway';
import { MockKycProvider } from '../kyc/kyc-provider';
import { KycService } from '../kyc/kyc.service';
import { MockPaymentProvider } from '../payments/payment-provider';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

/**
 * Development helpers. This controller is only registered when dev endpoints
 * are enabled, and configuration refuses that in production. They drive the
 * same signed-webhook code paths a real provider would use.
 */
@ApiExcludeController()
@Controller('dev')
export class DevController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kyc: KycService,
    private readonly mockKyc: MockKycProvider,
    private readonly subs: SubscriptionsService,
    private readonly mockPay: MockPaymentProvider,
    private readonly audit: AuditService,
    private readonly chain: SimulatedChainGateway,
  ) {}

  /** Simulated chain: mine N empty blocks now (confirmations without waiting). */
  @Post('chain/advance')
  @HttpCode(200)
  async advanceChain(@Body(new ZodValidationPipe(z.object({ blocks: z.number().int().min(1).max(1000) }))) body: { blocks: number }) {
    this.chain.advance(body.blocks);
    return { head: (await this.chain.head()).toString() };
  }

  /** Simulated chain: the next mint reverts with this reason. */
  @Post('chain/fail-next-mint')
  @HttpCode(204)
  failNextMint(@Body(new ZodValidationPipe(z.object({ reason: z.string().min(3).max(120) }))) body: { reason: string }) {
    this.chain.failNextMint(body.reason);
  }

  @Public()
  @Get('outbox')
  async outbox(@Query(new ZodValidationPipe(z.object({ email: emailSchema }))) q: { email: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: q.email } });
    if (!user) return { items: [] };
    const items = await this.prisma.notification.findMany({
      where: { userId: user.id, channel: 'EMAIL' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return { items: items.map((n) => ({ type: n.type, subject: n.title, body: n.body, data: n.data, sentAt: n.sentAt })) };
  }

  @Post('kyc/complete')
  @HttpCode(200)
  async completeKyc(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(z.object({ outcome: z.enum(['clear', 'consider', 'fail', 'pep', 'sanctions']) }))) body: { outcome: 'clear' | 'consider' | 'fail' | 'pep' | 'sanctions' },
  ) {
    const v = await this.prisma.kycVerification.findFirst({ where: { userId: auth.userId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
    if (!v?.providerReference) throw new NotFoundException({ code: 'NO_PENDING_KYC', message: 'Start verification first' });
    const evt = this.mockKyc.buildEvent(v.providerReference, body.outcome);
    return this.kyc.handleWebhook(Buffer.from(evt.body), evt.signature);
  }

  /**
   * Grants the signed-in account a staff role so the back office can be tried
   * locally (two accounts are needed for four-eyes steps). Never registered
   * in production.
   */
  @Post('roles/grant')
  @HttpCode(204)
  async grantRole(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(z.object({ role: z.enum(STAFF_ROLES) }))) body: { role: (typeof STAFF_ROLES)[number] },
  ) {
    const roleId = stableId('role', body.role);
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: auth.userId, roleId } },
        create: { userId: auth.userId, roleId },
        update: {},
      });
      await this.audit.record(tx, {
        actorType: 'SYSTEM',
        actorUserId: auth.userId,
        action: 'dev.role_granted',
        entityType: 'User',
        entityId: auth.userId,
        after: { role: body.role },
      });
    });
  }

  @Post('payments/:orderId/simulate')
  @HttpCode(200)
  async simulatePayment(
    @CurrentAuth() auth: AuthContext,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          outcome: z.enum(['succeeded', 'failed']),
          amount: z.string().regex(/^\d{1,15}$/).optional(),
          eventId: z.string().min(8).max(120).optional(),
        }),
      ),
    )
    body: { outcome: 'succeeded' | 'failed'; amount?: string; eventId?: string },
  ) {
    const order = await this.subs.get(auth, orderId);
    const payment = await this.prisma.payment.findFirst({ where: { orderId: order.id, purpose: 'SUBSCRIPTION' }, orderBy: { createdAt: 'desc' } });
    if (!payment?.providerReference) throw new NotFoundException({ code: 'NO_PAYMENT', message: 'Accept the documents first' });
    const evt = this.mockPay.buildEvent(payment.providerReference, body.outcome, BigInt(body.amount ?? payment.amount.toString()), body.eventId);
    return this.subs.handlePaymentWebhook(Buffer.from(evt.body), evt.signature);
  }
}
