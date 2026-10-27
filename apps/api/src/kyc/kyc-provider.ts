import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { signPayload, verifySignature } from '../common/webhook-signature';
import { APP_ENV, type AppEnv } from '../config/env';

const CHECK_TYPES = ['DOCUMENT', 'LIVENESS', 'IDENTITY_MATCH', 'ADDRESS', 'AML_SCREENING', 'SANCTIONS', 'PEP', 'ADVERSE_MEDIA', 'JURISDICTION'] as const;
const RESULTS = ['CLEAR', 'CONSIDER', 'FAIL', 'ERROR'] as const;

export const kycEventSchema = z.object({
  eventId: z.string().min(8).max(120),
  type: z.literal('kyc.completed'),
  providerReference: z.string().min(4).max(120),
  riskScore: z.number().int().min(0).max(100),
  pepMatch: z.boolean(),
  sanctionsMatch: z.boolean(),
  checks: z.array(z.object({ type: z.enum(CHECK_TYPES), result: z.enum(RESULTS), summary: z.string().max(500).optional() })).min(1),
});
export type KycEvent = z.infer<typeof kycEventSchema>;

/**
 * Port for identity-verification vendors. A real adapter maps the vendor's
 * API and webhook format onto these shapes; nothing else in the app changes.
 */
export abstract class KycProvider {
  abstract readonly key: string;
  abstract createCase(input: { verificationId: string; countryOfResidence: string }): Promise<{ providerReference: string; nextStepUrl: string | null }>;
  abstract parseWebhook(rawBody: Buffer | undefined, signature: string | undefined): KycEvent;
}

/** Deterministic mock: no data leaves the system. Outcomes are injected via the dev endpoint. */
@Injectable()
export class MockKycProvider extends KycProvider {
  readonly key = 'mock';

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {
    super();
  }

  async createCase() {
    return { providerReference: `mock_kyc_${randomBytes(9).toString('hex')}`, nextStepUrl: null };
  }

  parseWebhook(rawBody: Buffer | undefined, signature: string | undefined): KycEvent {
    verifySignature(this.env.KYC_WEBHOOK_SECRET, rawBody, signature);
    return kycEventSchema.parse(JSON.parse(rawBody!.toString('utf8')));
  }

  /** Dev only: build the signed webhook the vendor would send. */
  buildEvent(providerReference: string, outcome: 'clear' | 'consider' | 'fail' | 'pep' | 'sanctions'): { body: string; signature: string } {
    const result = outcome === 'fail' ? 'FAIL' : outcome === 'consider' ? 'CONSIDER' : 'CLEAR';
    const event: KycEvent = {
      eventId: `evt_${randomBytes(10).toString('hex')}`,
      type: 'kyc.completed',
      providerReference,
      riskScore: outcome === 'clear' ? 12 : outcome === 'consider' ? 55 : 90,
      pepMatch: outcome === 'pep',
      sanctionsMatch: outcome === 'sanctions',
      checks: [
        { type: 'DOCUMENT', result },
        { type: 'LIVENESS', result: 'CLEAR' },
        { type: 'IDENTITY_MATCH', result },
        { type: 'SANCTIONS', result: outcome === 'sanctions' ? 'FAIL' : 'CLEAR' },
        { type: 'PEP', result: outcome === 'pep' ? 'CONSIDER' : 'CLEAR' },
      ],
    };
    const body = JSON.stringify(event);
    return { body, signature: signPayload(this.env.KYC_WEBHOOK_SECRET, body) };
  }
}
