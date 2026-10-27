import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/** Integration tests: need TEST_DATABASE_URL pointing to a migrated + seeded database. */
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.int.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://jpt:jpt_dev_password@localhost:54329/jpt_test',
      IP_HASH_SECRET: 'test-ip-hash-secret-test-ip-hash-secret',
      PII_ENCRYPTION_KEY: '0'.repeat(64),
      KYC_WEBHOOK_SECRET: 'test-kyc-webhook-secret-0123456789abcdef',
      PAYMENT_WEBHOOK_SECRET: 'test-payment-webhook-secret-0123456789ab',
      ENABLE_DEV_ENDPOINTS: 'true',
      LOG_LEVEL: 'fatal',
      // Blocks only advance through /dev/chain/advance: deterministic confirmations.
      CHAIN_BLOCK_TIME_MS: '1000000000000',
      CHAIN_WORKER_INTERVAL_MS: '0',
    },
  },
});
