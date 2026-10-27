import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC is needed so Nest decorators emit metadata under Vitest.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.int.test.ts'],
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      IP_HASH_SECRET: 'test-secret-test-secret-test-secret-123',
      PII_ENCRYPTION_KEY: '0'.repeat(64),
      KYC_WEBHOOK_SECRET: 'test-kyc-webhook-secret-0123456789abcdef',
      PAYMENT_WEBHOOK_SECRET: 'test-payment-webhook-secret-0123456789ab',
      LOG_LEVEL: 'fatal',
    },
  },
});
