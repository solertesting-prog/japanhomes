import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { APP_ENV, type AppEnv } from '../config/env';

/**
 * Cryptographic helpers. In production the PII key comes from KMS via
 * Secrets Manager; the version byte allows key rotation.
 */
@Injectable()
export class CryptoService {
  private readonly piiKey: Buffer;
  private static readonly KEY_VERSION = 1;

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {
    this.piiKey = Buffer.from(env.PII_ENCRYPTION_KEY, 'hex');
  }

  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  sha256(value: string | Buffer): string {
    return createHash('sha256').update(value).digest('hex');
  }

  hmacHex(secret: string, value: string | Buffer): string {
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  /** Constant-time comparison of two hex/ascii strings. */
  safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }

  /** Keyed hash of an IP so logs can correlate abuse without storing the address. */
  ipHash(ip: string | undefined): string | null {
    return ip ? this.hmacHex(this.env.IP_HASH_SECRET, ip) : null;
  }

  /** AES-256-GCM. Output: [version(1)][iv(12)][tag(16)][ciphertext]. */
  encrypt(plaintext: string): Uint8Array<ArrayBuffer> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.piiKey, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return new Uint8Array(Buffer.concat([Buffer.from([CryptoService.KEY_VERSION]), iv, cipher.getAuthTag(), ct]));
  }

  decrypt(blob: Uint8Array): string {
    const buf = Buffer.from(blob);
    if (buf[0] !== CryptoService.KEY_VERSION) throw new Error('Unknown encryption key version');
    const decipher = createDecipheriv('aes-256-gcm', this.piiKey, buf.subarray(1, 13));
    decipher.setAuthTag(buf.subarray(13, 29));
    return Buffer.concat([decipher.update(buf.subarray(29)), decipher.final()]).toString('utf8');
  }
}
