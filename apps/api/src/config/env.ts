import { resolveAllModules } from '@jpt/shared';
import { z } from 'zod';

const secret = (name: string) => z.string().min(32, `${name} must be at least 32 characters`);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().optional(),
    /** Comma-separated list of exact origins allowed by CORS. */
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
    /** Public URL of the web app, used in email links. */
    APP_URL: z.string().url().default('http://localhost:3000'),
    /** Secret for keyed hashing of IPs in logs/audit. */
    IP_HASH_SECRET: secret('IP_HASH_SECRET'),
    /** 32-byte AES key (64 hex chars) for PII and MFA secrets. In production, from KMS. */
    PII_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'PII_ENCRYPTION_KEY must be 64 hex characters'),
    KYC_WEBHOOK_SECRET: secret('KYC_WEBHOOK_SECRET'),
    PAYMENT_WEBHOOK_SECRET: secret('PAYMENT_WEBHOOK_SECRET'),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(72).default(12),
    /** Secure cookies; defaults to true in production. */
    COOKIE_SECURE: z.enum(['true', 'false']).optional(),
    /** Dev-only helpers: email outbox, simulate KYC result, simulate payment. Never in production. */
    ENABLE_DEV_ENDPOINTS: z.enum(['true', 'false']).optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(10).default(120),
    /** Where tokens are issued. Only the in-process simulated chain exists so far. */
    CHAIN_GATEWAY: z.enum(['simulated']).default('simulated'),
    /** Blocks a mint must be buried under before it counts as final. */
    CHAIN_CONFIRMATIONS: z.coerce.number().int().min(1).max(64).default(2),
    /** Simulated chain block time. */
    CHAIN_BLOCK_TIME_MS: z.coerce.number().int().min(1).default(2_000),
    /** How often the allocation worker runs; 0 disables the timer (tests). */
    CHAIN_WORKER_INTERVAL_MS: z.coerce.number().int().min(0).default(15_000),
    /** Mint attempts before an allocation is parked as FAILED for manual review. */
    CHAIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(3),
  })
  .transform((e) => ({
    ...e,
    cookieSecure: e.COOKIE_SECURE ? e.COOKIE_SECURE === 'true' : e.NODE_ENV === 'production',
    devEndpoints: e.ENABLE_DEV_ENDPOINTS ? e.ENABLE_DEV_ENDPOINTS === 'true' : e.NODE_ENV !== 'production',
  }))
  .refine((e) => !(e.NODE_ENV === 'production' && e.devEndpoints), {
    message: 'ENABLE_DEV_ENDPOINTS cannot be true in production',
    path: ['ENABLE_DEV_ENDPOINTS'],
  });

export type AppEnv = z.infer<typeof envSchema>;

/**
 * Parses process.env once at boot. Invalid configuration — including a
 * regulated module switched on without a legal approval reference — stops the
 * process before it can serve a single request.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  resolveAllModules(source);
  return parsed.data;
}

export const APP_ENV = Symbol('APP_ENV');
