import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DUMMY_HASH, hashPassword, needsRehash, stableId, verifyPassword } from '@jpt/database';
import type { MeDto } from '@jpt/shared';
import type { Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { CryptoService } from '../common/crypto.service';
import { type AppRequest, type AuthContext, requestMeta } from '../common/request-context';
import { generateTotpSecret, otpauthUri, verifyTotp } from '../common/totp';
import { APP_ENV, type AppEnv } from '../config/env';
import { Mailer } from '../mail/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from './session.service';

export const LEGAL_VERSIONS = { terms: 'terms-2026-10-draft', privacy: 'privacy-2026-10-draft' } as const;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
const EMAIL_TOKEN_HOURS = 24;
const RESET_TOKEN_MINUTES = 30;

const invalidCredentials = () =>
  new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' });

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly mailer: Mailer,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  /* Registration ---------------------------------------------------------- */

  /**
   * Always answers the same way, whether or not the email exists, so the
   * endpoint cannot be used to discover who has an account.
   */
  async register(input: { email: string; password: string; locale: string }, req: AppRequest): Promise<void> {
    const meta = requestMeta(req);
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      await this.mailer.send({
        userId: existing.id,
        to: existing.email,
        type: 'auth.register_existing',
        subject: 'Someone tried to create an account with your email',
        text: `If this was you, sign in or reset your password at ${this.env.APP_URL}/sign-in.`,
      });
      return;
    }
    const passwordHash = await hashPassword(input.password);
    const token = this.crypto.randomToken();
    const user = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email: input.email, passwordHash, locale: input.locale } });
      await tx.userRole.create({ data: { userId: user.id, roleId: stableId('role', 'INVESTOR') } });
      await tx.consent.createMany({
        data: [
          { userId: user.id, type: 'TERMS_OF_SERVICE', version: LEGAL_VERSIONS.terms, ipHash: this.crypto.ipHash(meta.ip), userAgent: meta.userAgent?.slice(0, 512) },
          { userId: user.id, type: 'PRIVACY_POLICY', version: LEGAL_VERSIONS.privacy, ipHash: this.crypto.ipHash(meta.ip), userAgent: meta.userAgent?.slice(0, 512) },
        ],
      });
      await tx.authToken.create({
        data: {
          userId: user.id,
          type: 'EMAIL_VERIFICATION',
          tokenHash: this.crypto.sha256(token),
          expiresAt: new Date(Date.now() + EMAIL_TOKEN_HOURS * 3_600_000),
        },
      });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: user.id,
        action: 'user.registered',
        entityType: 'User',
        entityId: user.id,
        after: { email: user.email, locale: user.locale },
        requestId: meta.requestId,
        ipHash: this.crypto.ipHash(meta.ip),
        userAgent: meta.userAgent,
      });
      return user;
    });
    // Sent after commit so a rolled-back registration never emails a dead link.
    await this.mailer.send({
      userId: user.id,
      to: user.email,
      type: 'auth.verify_email',
      subject: 'Confirm your email address',
      text: `Confirm your email: ${this.env.APP_URL}/verify-email?token=${token}`,
      data: { token },
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.consumeToken(token, 'EMAIL_VERIFICATION');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: record.userId,
        action: 'user.email_verified',
        entityType: 'User',
        entityId: record.userId,
      });
    });
  }

  /* Sign-in -------------------------------------------------------------- */

  async login(input: { email: string; password: string }, req: AppRequest, res: Response): Promise<MeDto> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Hash even when the user does not exist so timing does not reveal accounts.
    const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user) throw invalidCredentials();

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      // Same answer as a wrong password: lockout status is not disclosed.
      throw invalidCredentials();
    }
    if (!valid) {
      await this.registerFailure(user.id, user.email, user.failedLoginCount, req);
      throw invalidCredentials();
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException({ code: 'ACCOUNT_DISABLED', message: 'This account is disabled. Contact support.' });
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED', message: 'Confirm your email address before signing in' });
    }

    const data: { failedLoginCount: number; lockedUntil: null; lastLoginAt: Date; passwordHash?: string } = {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    };
    if (needsRehash(user.passwordHash)) data.passwordHash = await hashPassword(input.password);
    await this.prisma.user.update({ where: { id: user.id }, data });

    const sessionId = await this.sessions.create(user.id, req, res, { mfaVerified: !user.mfaEnabled });
    const meta = requestMeta(req);
    await this.prisma.$transaction((tx) =>
      this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: user.id,
        action: 'auth.login',
        entityType: 'Session',
        entityId: sessionId,
        after: { mfaPending: user.mfaEnabled },
        requestId: meta.requestId,
        ipHash: this.crypto.ipHash(meta.ip),
        userAgent: meta.userAgent,
      }),
    );
    return this.me(user.id, user.mfaEnabled);
  }

  private async registerFailure(userId: string, email: string, previous: number, req: AppRequest) {
    const count = previous + 1;
    const lock = count >= MAX_FAILED_ATTEMPTS;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: lock ? 0 : count,
        lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : undefined,
      },
    });
    if (lock) {
      const meta = requestMeta(req);
      await this.prisma.$transaction((tx) =>
        this.audit.record(tx, {
          actorType: 'SYSTEM',
          action: 'auth.locked',
          entityType: 'User',
          entityId: userId,
          after: { minutes: LOCKOUT_MINUTES },
          requestId: meta.requestId,
          ipHash: this.crypto.ipHash(meta.ip),
        }),
      );
      await this.mailer.send({
        userId,
        to: email,
        type: 'auth.locked',
        subject: 'Your account was temporarily locked',
        text: `After ${MAX_FAILED_ATTEMPTS} failed sign-in attempts your account is locked for ${LOCKOUT_MINUTES} minutes. If this was not you, reset your password.`,
      });
    }
  }

  async logout(auth: AuthContext, res: Response): Promise<void> {
    await this.sessions.revoke(auth.sessionId, res);
  }

  /* Second factor -------------------------------------------------------- */

  async mfaSetup(auth: AuthContext): Promise<{ secret: string; otpauthUri: string }> {
    if (auth.mfaEnabled) throw new ConflictException({ code: 'MFA_ALREADY_ENABLED', message: 'Two-factor authentication is already on' });
    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: auth.userId }, data: { mfaSecretEnc: this.crypto.encrypt(secret) } });
    return { secret, otpauthUri: otpauthUri(secret, auth.email) };
  }

  async mfaEnable(auth: AuthContext, code: string, req: AppRequest): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    if (user.mfaEnabled) throw new ConflictException({ code: 'MFA_ALREADY_ENABLED', message: 'Two-factor authentication is already on' });
    if (!user.mfaSecretEnc) throw new BadRequestException({ code: 'MFA_NOT_SET_UP', message: 'Start two-factor setup first' });
    if (!verifyTotp(this.crypto.decrypt(user.mfaSecretEnc), code)) {
      throw new BadRequestException({ code: 'MFA_CODE_INVALID', message: 'That code is not valid. Check your device clock and try again.' });
    }
    const meta = requestMeta(req);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: auth.userId }, data: { mfaEnabled: true } });
      await tx.session.update({ where: { id: auth.sessionId }, data: { mfaVerifiedAt: new Date() } });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: auth.userId,
        action: 'auth.mfa_enabled',
        entityType: 'User',
        entityId: auth.userId,
        requestId: meta.requestId,
      });
    });
    // Other sessions were opened with a weaker factor.
    await this.sessions.revokeAllForUser(auth.userId, auth.sessionId);
  }

  async mfaVerify(auth: AuthContext, code: string, req: AppRequest, res: Response): Promise<MeDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    if (!user.mfaEnabled || !user.mfaSecretEnc) return this.me(user.id, false);
    if (!verifyTotp(this.crypto.decrypt(user.mfaSecretEnc), code)) {
      await this.registerFailure(user.id, user.email, user.failedLoginCount, req);
      const after = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      if (after.lockedUntil && after.lockedUntil > new Date()) await this.sessions.revoke(auth.sessionId, res);
      throw new BadRequestException({ code: 'MFA_CODE_INVALID', message: 'That code is not valid' });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0 } });
    await this.sessions.markMfaVerified(auth.sessionId);
    return this.me(user.id, false);
  }

  /* Password reset ------------------------------------------------------- */

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') return;
    const token = this.crypto.randomToken();
    await this.prisma.authToken.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash: this.crypto.sha256(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000),
      },
    });
    await this.mailer.send({
      userId: user.id,
      to: user.email,
      type: 'auth.password_reset',
      subject: 'Reset your password',
      text: `Reset your password within ${RESET_TOKEN_MINUTES} minutes: ${this.env.APP_URL}/reset-password?token=${token}`,
      data: { token },
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const record = await this.consumeToken(token, 'PASSWORD_RESET');
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: record.userId,
        action: 'auth.password_reset',
        entityType: 'User',
        entityId: record.userId,
      });
    });
    await this.sessions.revokeAllForUser(record.userId);
  }

  private async consumeToken(token: string, type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET') {
    const record = await this.prisma.authToken.findUnique({ where: { tokenHash: this.crypto.sha256(token) } });
    if (!record || record.type !== type || record.usedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException({ code: 'TOKEN_INVALID', message: 'This link is invalid or has expired. Request a new one.' });
    }
    const used = await this.prisma.authToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count !== 1) throw new BadRequestException({ code: 'TOKEN_INVALID', message: 'This link has already been used' });
    return record;
  }

  /* Profile -------------------------------------------------------------- */

  async me(userId: string, mfaPending: boolean): Promise<MeDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        kycVerifications: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const perms = new Set<string>();
    for (const ur of user.roles) for (const rp of ur.role.permissions) perms.add(rp.permission.key);
    const kyc = user.kycVerifications[0];
    const kycStatus = kyc && kyc.status === 'APPROVED' && kyc.expiresAt && kyc.expiresAt <= new Date() ? 'EXPIRED' : (kyc?.status ?? 'NOT_STARTED');
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      locale: user.locale,
      roles: user.roles.map((r) => r.role.key),
      permissions: [...perms].sort(),
      mfaEnabled: user.mfaEnabled,
      mfaPending,
      kycStatus,
    };
  }
}
