import { createHmac, timingSafeEqual } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';

/**
 * Stripe-style signatures: header `t=<unix seconds>,v1=<hex hmac>` over
 * `${t}.${rawBody}`. The timestamp window stops replay of captured requests.
 */
export const SIGNATURE_HEADER = 'x-jpt-signature';
const TOLERANCE_SECONDS = 300;

export function signPayload(secret: string, rawBody: string, nowMs = Date.now()): string {
  const t = Math.floor(nowMs / 1000);
  const v1 = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

export function verifySignature(secret: string, rawBody: Buffer | undefined, header: string | undefined, nowMs = Date.now()): void {
  const fail = (why: string) => new UnauthorizedException({ code: 'WEBHOOK_SIGNATURE_INVALID', message: why });
  if (!rawBody) throw fail('Missing request body');
  if (!header) throw fail('Missing signature header');
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=', 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1) throw fail('Malformed signature header');
  if (Math.abs(nowMs / 1000 - t) > TOLERANCE_SECONDS) throw fail('Signature timestamp outside tolerance');
  const expected = createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest();
  const given = Buffer.from(parts.v1, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw fail('Signature mismatch');
}
