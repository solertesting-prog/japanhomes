import { Inject, Injectable } from '@nestjs/common';
import { COOKIE_CSRF, COOKIE_SESSION } from '@jpt/shared';
import type { Response } from 'express';
import { clearCookie, setCookie } from '../common/cookies';
import { CryptoService } from '../common/crypto.service';
import type { AppRequest, AuthContext } from '../common/request-context';
import { APP_ENV, type AppEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Opaque server-side sessions. The cookie holds a random token; the database
 * holds only its SHA-256, so a database leak does not leak live sessions.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async create(userId: string, req: AppRequest, res: Response, opts: { mfaVerified: boolean }): Promise<string> {
    const token = this.crypto.randomToken(32);
    const ttlMs = this.env.SESSION_TTL_HOURS * 3_600_000;
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.crypto.sha256(token),
        userAgent: req.headers['user-agent']?.slice(0, 512) ?? null,
        ipHash: this.crypto.ipHash(req.ip),
        mfaVerifiedAt: opts.mfaVerified ? new Date() : null,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    const maxAge = Math.floor(ttlMs / 1000);
    setCookie(res, COOKIE_SESSION, token, { httpOnly: true, secure: this.env.cookieSecure, maxAgeSeconds: maxAge });
    // Double-submit CSRF token: readable by the web app, echoed in X-CSRF-Token.
    setCookie(res, COOKIE_CSRF, this.crypto.randomToken(24), { httpOnly: false, secure: this.env.cookieSecure, maxAgeSeconds: maxAge });
    return session.id;
  }

  async resolve(token: string): Promise<AuthContext | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.crypto.sha256(token) },
      include: {
        user: {
          include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
        },
      },
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now) return null;
    const user = session.user;
    if (user.status !== 'ACTIVE') return null;

    // Sliding activity marker, written at most once a minute.
    if (now.getTime() - session.lastSeenAt.getTime() > 60_000) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    }

    const permissions = new Set<string>();
    for (const ur of user.roles) for (const rp of ur.role.permissions) permissions.add(rp.permission.key);
    return {
      userId: user.id,
      sessionId: session.id,
      email: user.email,
      roles: user.roles.map((r) => r.role.key),
      permissions,
      mfaEnabled: user.mfaEnabled,
      mfaVerified: !user.mfaEnabled || session.mfaVerifiedAt !== null,
      emailVerified: user.emailVerifiedAt !== null,
    };
  }

  async markMfaVerified(sessionId: string): Promise<void> {
    await this.prisma.session.update({ where: { id: sessionId }, data: { mfaVerifiedAt: new Date() } });
  }

  async revoke(sessionId: string, res?: Response): Promise<void> {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (res) this.clear(res);
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
  }

  clear(res: Response): void {
    clearCookie(res, COOKIE_SESSION, this.env.cookieSecure);
    clearCookie(res, COOKIE_CSRF, this.env.cookieSecure);
  }
}
