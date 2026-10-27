import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type KycVerification, Prisma, stableId } from '@jpt/database';
import { assessEligibility, resolveModuleState } from '@jpt/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../common/request-context';
import { Mailer } from '../mail/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import { KycProvider } from './kyc-provider';

const KYC_VALIDITY_DAYS = 365;
const MANUAL_REVIEW_RISK = 50;

export interface KycStatusDto {
  id: string | null;
  status: KycVerification['status'];
  submittedAt: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
  decisionReason: string | null;
  eligibility: { simulatedAllowed: boolean; realAllowed: boolean } | null;
}

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: KycProvider,
    private readonly audit: AuditService,
    private readonly mailer: Mailer,
  ) {}

  async status(userId: string): Promise<KycStatusDto> {
    const v = await this.prisma.kycVerification.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
    const e = await this.prisma.investorEligibility.findFirst({ where: { userId }, orderBy: { assessedAt: 'desc' } });
    const expired = v?.status === 'APPROVED' && v.expiresAt !== null && v.expiresAt <= new Date();
    const rules = (e?.ruleResults ?? null) as { simulatedAllowed?: boolean; realAllowed?: boolean } | null;
    return {
      id: v?.id ?? null,
      status: expired ? 'EXPIRED' : (v?.status ?? 'NOT_STARTED'),
      submittedAt: v?.submittedAt?.toISOString() ?? null,
      reviewedAt: v?.reviewedAt?.toISOString() ?? null,
      expiresAt: v?.expiresAt?.toISOString() ?? null,
      decisionReason: v?.status === 'REJECTED' ? 'Your verification could not be completed. Contact support for details.' : null,
      eligibility: e && v?.status === 'APPROVED' && !expired ? { simulatedAllowed: !!rules?.simulatedAllowed, realAllowed: !!rules?.realAllowed } : null,
    };
  }

  async start(auth: AuthContext, input: { countryOfResidence: string; nationality: string; isEntity: boolean }) {
    const latest = await this.prisma.kycVerification.findFirst({ where: { userId: auth.userId }, orderBy: { createdAt: 'desc' } });
    if (latest?.status === 'APPROVED' && latest.expiresAt && latest.expiresAt > new Date()) {
      throw new ConflictException({ code: 'KYC_ALREADY_APPROVED', message: 'Your identity is already verified' });
    }
    if (latest && (latest.status === 'PENDING' || latest.status === 'UNDER_REVIEW')) return this.status(auth.userId);

    const verification = await this.prisma.$transaction(async (tx) => {
      await tx.userProfile.upsert({
        where: { userId: auth.userId },
        create: { userId: auth.userId, countryOfResidence: input.countryOfResidence, nationality: input.nationality, isEntity: input.isEntity },
        update: { countryOfResidence: input.countryOfResidence, nationality: input.nationality, isEntity: input.isEntity },
      });
      const v = await tx.kycVerification.create({
        data: { userId: auth.userId, provider: this.provider.key, status: 'PENDING', submittedAt: new Date() },
      });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: auth.userId,
        action: 'kyc.started',
        entityType: 'KycVerification',
        entityId: v.id,
        after: { countryOfResidence: input.countryOfResidence, isEntity: input.isEntity },
      });
      return v;
    });
    const { providerReference } = await this.provider.createCase({
      verificationId: verification.id,
      countryOfResidence: input.countryOfResidence,
    });
    await this.prisma.kycVerification.update({ where: { id: verification.id }, data: { providerReference } });
    return this.status(auth.userId);
  }

  /** Provider webhook: signature-checked, de-duplicated, idempotent. */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<{ status: string }> {
    const event = this.provider.parseWebhook(rawBody, signature);
    let webhookId: string;
    try {
      const w = await this.prisma.inboundWebhook.create({
        data: {
          provider: `kyc:${this.provider.key}`,
          eventId: event.eventId,
          eventType: event.type,
          signatureVerified: true,
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });
      webhookId = w.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { status: 'duplicate' };
      throw e;
    }

    const v = await this.prisma.kycVerification.findFirst({
      where: { provider: this.provider.key, providerReference: event.providerReference },
      include: { user: true },
    });
    if (!v || v.status !== 'PENDING') {
      await this.prisma.inboundWebhook.update({
        where: { id: webhookId },
        data: { status: 'REJECTED', error: v ? `Verification is ${v.status}` : 'Unknown reference', processedAt: new Date() },
      });
      return { status: 'ignored' };
    }

    const anyFail = event.checks.some((c) => c.result === 'FAIL' || c.result === 'ERROR');
    const anyConsider = event.checks.some((c) => c.result === 'CONSIDER');
    const decision: 'REJECTED' | 'UNDER_REVIEW' | 'APPROVED' =
      anyFail || event.sanctionsMatch
        ? 'REJECTED'
        : anyConsider || event.pepMatch || event.riskScore >= MANUAL_REVIEW_RISK
          ? 'UNDER_REVIEW'
          : 'APPROVED';

    await this.prisma.$transaction(async (tx) => {
      await tx.kycCheck.createMany({
        data: event.checks.map((c) => ({ verificationId: v.id, type: c.type, result: c.result, summary: c.summary ?? null })),
      });
      await tx.kycVerification.update({
        where: { id: v.id },
        data: { riskScore: event.riskScore, pepMatch: event.pepMatch, sanctionsMatch: event.sanctionsMatch },
      });
      if (decision === 'APPROVED') {
        await this.approve(tx, v.id, null);
      } else {
        await tx.kycVerification.update({
          where: { id: v.id },
          data: {
            status: decision,
            decisionReason: decision === 'REJECTED' ? 'Automated checks failed' : 'Automated checks require manual review',
            reviewedAt: decision === 'REJECTED' ? new Date() : null,
          },
        });
        await this.audit.record(tx, {
          actorType: 'WEBHOOK',
          action: decision === 'REJECTED' ? 'kyc.rejected' : 'kyc.manual_review',
          entityType: 'KycVerification',
          entityId: v.id,
          after: { riskScore: event.riskScore, pepMatch: event.pepMatch, sanctionsMatch: event.sanctionsMatch },
        });
      }
      await tx.inboundWebhook.update({ where: { id: webhookId }, data: { status: 'PROCESSED', processedAt: new Date() } });
    });
    await this.notify(v.userId, v.user.email, decision);
    return { status: decision };
  }

  /** Manual decision by a compliance officer (four-eyes: never on their own case). */
  async review(reviewer: AuthContext, verificationId: string, decision: 'APPROVE' | 'REJECT', reason: string) {
    const v = await this.prisma.kycVerification.findUnique({ where: { id: verificationId }, include: { user: true } });
    if (!v) throw new NotFoundException({ code: 'KYC_NOT_FOUND', message: 'Verification not found' });
    if (v.userId === reviewer.userId) throw new ForbiddenException({ code: 'FOUR_EYES', message: 'You cannot review your own verification' });
    if (v.status !== 'UNDER_REVIEW') {
      throw new BadRequestException({ code: 'KYC_NOT_REVIEWABLE', message: `Only cases under review can be decided (this one is ${v.status})` });
    }
    await this.prisma.$transaction(async (tx) => {
      if (decision === 'APPROVE') {
        await this.approve(tx, v.id, reviewer.userId, reason);
      } else {
        await tx.kycVerification.update({
          where: { id: v.id },
          data: { status: 'REJECTED', reviewedAt: new Date(), reviewedById: reviewer.userId, decisionReason: reason },
        });
        await tx.userRole.deleteMany({ where: { userId: v.userId, roleId: stableId('role', 'VERIFIED_INVESTOR') } });
        await this.audit.record(tx, {
          actorType: 'USER',
          actorUserId: reviewer.userId,
          action: 'kyc.rejected',
          entityType: 'KycVerification',
          entityId: v.id,
          after: { reason },
        });
      }
    });
    await this.notify(v.userId, v.user.email, decision === 'APPROVE' ? 'APPROVED' : 'REJECTED');
    return this.prisma.kycVerification.findUniqueOrThrow({ where: { id: v.id } });
  }

  async queue(status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED') {
    const rows = await this.prisma.kycVerification.findMany({
      where: { status },
      orderBy: { submittedAt: 'asc' },
      take: 100,
      include: { user: { select: { email: true, profile: { select: { countryOfResidence: true, isEntity: true } } } }, checks: true },
    });
    return rows.map((r) => ({
      id: r.id,
      email: r.user.email,
      countryOfResidence: r.user.profile?.countryOfResidence ?? null,
      isEntity: r.user.profile?.isEntity ?? false,
      status: r.status,
      riskScore: r.riskScore,
      pepMatch: r.pepMatch,
      sanctionsMatch: r.sanctionsMatch,
      submittedAt: r.submittedAt?.toISOString() ?? null,
      checks: r.checks.map((c) => ({ type: c.type, result: c.result })),
    }));
  }

  private async approve(tx: Prisma.TransactionClient, verificationId: string, reviewerId: string | null, reason?: string) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + KYC_VALIDITY_DAYS * 86_400_000);
    const v = await tx.kycVerification.update({
      where: { id: verificationId },
      data: { status: 'APPROVED', reviewedAt: now, reviewedById: reviewerId, expiresAt, decisionReason: reason ?? 'Automated checks clear' },
      include: { user: { include: { profile: true } } },
    });
    const profile = v.user.profile;
    const assessment = assessEligibility({
      kycStatus: 'APPROVED',
      kycExpiresAt: expiresAt,
      sanctionsMatch: v.sanctionsMatch,
      pepMatch: v.pepMatch,
      countryOfResidence: profile?.countryOfResidence ?? null,
      isEntity: profile?.isEntity ?? false,
      beneficialOwnersVerified: false,
      crossBorderEnabled: resolveModuleState('CROSS_BORDER_INVESTORS', process.env).enabled,
      now,
    });
    await tx.investorEligibility.create({
      data: {
        userId: v.userId,
        jurisdiction: profile?.countryOfResidence ?? 'ZZ',
        category: 'RETAIL',
        isEligible: assessment.simulatedAllowed,
        ruleResults: {
          simulatedAllowed: assessment.simulatedAllowed,
          realAllowed: assessment.realAllowed,
          requiresEnhancedDueDiligence: assessment.requiresEnhancedDueDiligence,
          results: assessment.results,
        } as unknown as Prisma.InputJsonValue,
        ruleSetVersion: assessment.rulesetVersion,
        assessedById: reviewerId,
        validUntil: expiresAt,
      },
    });
    if (assessment.simulatedAllowed) {
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: v.userId, roleId: stableId('role', 'VERIFIED_INVESTOR') } },
        create: { userId: v.userId, roleId: stableId('role', 'VERIFIED_INVESTOR'), grantedById: reviewerId },
        update: {},
      });
    }
    await this.audit.record(tx, {
      actorType: reviewerId ? 'USER' : 'WEBHOOK',
      actorUserId: reviewerId,
      action: 'kyc.approved',
      entityType: 'KycVerification',
      entityId: v.id,
      after: { eligibility: { simulated: assessment.simulatedAllowed, real: assessment.realAllowed }, ruleset: assessment.rulesetVersion },
    });
  }

  private async notify(userId: string, email: string, decision: 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW') {
    const copy: [string, string] = {
      APPROVED: ['Your identity is verified', 'You can now review offering documents and subscribe to open DEMO offerings.'],
      REJECTED: ['We could not verify your identity', 'Your verification was not approved. Contact support if you think this is a mistake.'],
      UNDER_REVIEW: ['Your verification needs a manual review', 'A compliance officer will review your case. We will email you with the result.'],
    }[decision] as [string, string];
    await this.mailer.send({ userId, to: email, type: `kyc.${decision.toLowerCase()}`, subject: copy[0], text: copy[1] });
  }
}
