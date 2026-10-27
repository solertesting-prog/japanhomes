import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { signPayload, verifySignature } from '../common/webhook-signature';
import { APP_ENV, type AppEnv } from '../config/env';

export const paymentEventSchema = z.object({
  eventId: z.string().min(8).max(120),
  type: z.enum(['payment.succeeded', 'payment.failed']),
  providerReference: z.string().min(4).max(120),
  amount: z.string().regex(/^\d{1,15}$/).transform((v) => BigInt(v)),
  currency: z.literal('JPY'),
  failureCode: z.string().max(80).optional(),
});
export type PaymentEvent = z.output<typeof paymentEventSchema>;

export interface PaymentInstructions {
  method: string;
  reference: string;
  amount: string;
  currency: 'JPY';
  note: string;
}

/**
 * Port for a licensed payment / escrow provider. No real provider is wired:
 * accepting money for investments needs an authorised partner (see
 * docs/LEGAL_MODEL.md). The mock never moves money.
 */
export abstract class PaymentProvider {
  abstract readonly key: string;
  abstract createIntent(input: { paymentId: string; amount: bigint; reference: string }): Promise<{ providerReference: string; instructions: PaymentInstructions }>;
  abstract refund(input: { providerReference: string; amount: bigint }): Promise<{ refundReference: string }>;
  /** Outbound transfer to an investor (distributions). Idempotent on `idempotencyKey`. */
  abstract payout(input: { idempotencyKey: string; amount: bigint; reference: string }): Promise<{ providerReference: string; status: 'SUCCEEDED' | 'FAILED'; failureCode?: string }>;
  abstract parseWebhook(rawBody: Buffer | undefined, signature: string | undefined): PaymentEvent;
}

@Injectable()
export class MockPaymentProvider extends PaymentProvider {
  readonly key = 'mock';

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {
    super();
  }

  async createIntent(input: { paymentId: string; amount: bigint; reference: string }) {
    return {
      providerReference: `mock_pay_${randomBytes(9).toString('hex')}`,
      instructions: {
        method: 'SIMULATED_BANK_TRANSFER',
        reference: input.reference,
        amount: input.amount.toString(),
        currency: 'JPY' as const,
        note: 'DEMO: no real money moves. Use the simulator to confirm or fail this payment.',
      },
    };
  }

  async refund() {
    return { refundReference: `mock_refund_${randomBytes(9).toString('hex')}` };
  }

  /** Simulated payout: settles instantly and deterministically per key. No money moves. */
  async payout(input: { idempotencyKey: string; amount: bigint; reference: string }) {
    const ref = createHash('sha256').update(input.idempotencyKey).digest('hex').slice(0, 18);
    return { providerReference: `mock_payout_${ref}`, status: 'SUCCEEDED' as const };
  }

  parseWebhook(rawBody: Buffer | undefined, signature: string | undefined): PaymentEvent {
    verifySignature(this.env.PAYMENT_WEBHOOK_SECRET, rawBody, signature);
    return paymentEventSchema.parse(JSON.parse(rawBody!.toString('utf8')));
  }

  /** Dev only: the webhook the provider would send. */
  buildEvent(providerReference: string, outcome: 'succeeded' | 'failed', amount: bigint, eventId?: string) {
    const body = JSON.stringify({
      eventId: eventId ?? `evt_${randomBytes(10).toString('hex')}`,
      type: `payment.${outcome}`,
      providerReference,
      amount: amount.toString(),
      currency: 'JPY',
      ...(outcome === 'failed' ? { failureCode: 'insufficient_funds' } : {}),
    });
    return { body, signature: signPayload(this.env.PAYMENT_WEBHOOK_SECRET, body) };
  }
}
