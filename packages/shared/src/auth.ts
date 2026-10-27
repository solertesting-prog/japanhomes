import { z } from 'zod';
import { SUPPORTED_LOCALES } from './domain';

/** Shared by the API (validation) and the web (forms), so both enforce the same rules. */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email('Enter a valid email address');

/**
 * NIST SP 800-63B style: length over composition rules. 12–128 characters,
 * any characters allowed, no forced symbols. Breached-password screening is
 * a Phase 5 integration.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128, 'Use at most 128 characters')
  .refine((p) => p.trim().length === p.length, 'Remove spaces at the start or end')
  .refine((p) => new Set(p).size >= 5, 'Use a less repetitive password');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  locale: z.enum(SUPPORTED_LOCALES).default('en'),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms to continue' }) }),
  acceptPrivacy: z.literal(true, { errorMap: () => ({ message: 'You must accept the privacy policy to continue' }) }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const tokenSchema = z.object({ token: z.string().min(20).max(200) });

export const totpCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') });

export const passwordResetRequestSchema = z.object({ email: emailSchema });

export const passwordResetSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });

export const kycStartSchema = z.object({
  countryOfResidence: z.string().regex(/^[A-Z]{2}$/, 'ISO 3166-1 alpha-2 country code'),
  nationality: z.string().regex(/^[A-Z]{2}$/, 'ISO 3166-1 alpha-2 country code'),
  isEntity: z.boolean().default(false),
});

export const createSubscriptionSchema = z.object({
  propertySlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,13}$/, 'Amount must be whole yen, digits only')
    .transform((v) => BigInt(v)),
});

export const acceptDocumentsSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(20),
});

export const COOKIE_SESSION = 'jpt_session';
export const COOKIE_CSRF = 'jpt_csrf';
export const HEADER_CSRF = 'x-csrf-token';
export const HEADER_IDEMPOTENCY = 'idempotency-key';

export interface MeDto {
  id: string;
  email: string;
  emailVerified: boolean;
  locale: string;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
  mfaPending: boolean;
  kycStatus: 'NOT_STARTED' | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
}
