import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdminOverviewDto,
  type AdminPropertyDto,
  type AuditEntryDto,
  type AuditVerifyDto,
  EXPENSE_CATEGORIES,
  type FinanceRecordsDto,
  OFFERING_STATUSES,
  OFFERING_TRANSITIONS,
  type OfferingStatusKey,
  toWire,
} from '@jpt/shared';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { CurrentAuth, RequirePermissions, Staff } from '../auth/decorators';
import type { AuthContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { DistributionsService } from './distributions.service';

const yenString = z
  .string()
  .regex(/^\d{1,15}$/, 'Whole yen, digits only')
  .transform((v) => BigInt(v));
const positiveYen = yenString.refine((v) => v > 0n, 'Must be more than zero');
const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((v) => new Date(`${v}T00:00:00Z`))
  .refine((d) => !Number.isNaN(d.getTime()), 'Invalid date');
const isoMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .transform((v) => new Date(`${v}-01T00:00:00Z`));

// -----------------------------------------------------------------------------

@ApiTags('admin')
@Staff()
@Controller('admin/overview')
export class AdminOverviewController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Back-office counters' })
  async overview(): Promise<AdminOverviewDto> {
    const p = this.prisma;
    const [users, staff, verified, kycPending, kycReview, awaiting, allocated, refunded, raised, toApprove, toPay, audit] = await Promise.all([
      p.user.count(),
      p.user.count({ where: { roles: { some: { role: { key: { in: ['PROPERTY_MANAGER', 'COMPLIANCE_OFFICER', 'ADMINISTRATOR', 'SUPER_ADMINISTRATOR'] } } } } } }),
      p.user.count({ where: { roles: { some: { role: { key: 'VERIFIED_INVESTOR' } } } } }),
      p.kycVerification.count({ where: { status: 'PENDING' } }),
      p.kycVerification.count({ where: { status: 'UNDER_REVIEW' } }),
      p.subscriptionOrder.count({ where: { status: 'AWAITING_PAYMENT' } }),
      p.subscriptionOrder.count({ where: { status: 'ALLOCATED' } }),
      p.subscriptionOrder.count({ where: { status: 'REFUNDED' } }),
      p.subscriptionOrder.aggregate({ where: { status: 'ALLOCATED' }, _sum: { amount: true } }),
      p.distribution.count({ where: { status: 'CALCULATED' } }),
      p.distribution.count({ where: { status: { in: ['APPROVED', 'PAYING'] } } }),
      p.auditLog.count(),
    ]);
    return {
      users: { total: users, staff, verifiedInvestors: verified },
      kyc: { pending: kycPending, underReview: kycReview },
      orders: { awaitingPayment: awaiting, allocated, refunded },
      raised: toWire(raised._sum.amount ?? 0n),
      distributions: { awaitingApproval: toApprove, awaitingPayment: toPay },
      audit: { entries: audit },
    };
  }
}

// -----------------------------------------------------------------------------

const transitionSchema = z.object({
  to: z.enum(OFFERING_STATUSES),
  legalApprovalRef: z.string().trim().min(3).max(200).optional(),
});

@ApiTags('admin')
@Staff()
@Controller('admin')
export class AdminPropertiesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('properties')
  @RequirePermissions('property:read')
  @ApiOperation({ summary: 'Every property with its offerings, any status' })
  async list(): Promise<AdminPropertyDto[]> {
    const rows = await this.prisma.property.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: { offerings: { orderBy: { createdAt: 'asc' }, include: { _count: { select: { investments: true } } } } },
    });
    return rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      city: p.city,
      status: p.status,
      featured: p.featured,
      isDemo: p.isDemo,
      offerings: p.offerings.map((o) => ({
        id: o.id,
        tokenSymbol: o.tokenSymbol,
        status: o.status,
        isDemo: o.isDemo,
        totalTokens: toWire(o.totalTokens),
        tokensSold: toWire(o.tokensSold),
        tokensReserved: toWire(o.tokensReserved),
        tokenPrice: toWire(o.tokenPrice),
        legalApprovalRef: o.legalApprovalRef,
        investors: o._count.investments,
      })),
    }));
  }

  @Post('properties/:id/visibility')
  @HttpCode(204)
  @RequirePermissions('property:publish')
  async visibility(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(z.object({ status: z.enum(['PUBLISHED', 'UNPUBLISHED']) }))) body: { status: 'PUBLISHED' | 'UNPUBLISHED' },
  ) {
    const p = await this.prisma.property.findUnique({ where: { id } });
    if (!p) throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND', message: 'Property not found' });
    if (p.status === body.status) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.property.update({
        where: { id },
        data: { status: body.status, publishedAt: body.status === 'PUBLISHED' ? (p.publishedAt ?? new Date()) : p.publishedAt },
      });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: auth.userId,
        action: body.status === 'PUBLISHED' ? 'property.published' : 'property.unpublished',
        entityType: 'Property',
        entityId: id,
        before: { status: p.status },
        after: { status: body.status },
      });
    });
  }

  @Post('properties/:id/featured')
  @HttpCode(204)
  @RequirePermissions('property:write')
  async featured(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(z.object({ featured: z.boolean() }))) body: { featured: boolean },
  ) {
    const p = await this.prisma.property.findUnique({ where: { id } });
    if (!p) throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND', message: 'Property not found' });
    await this.prisma.$transaction(async (tx) => {
      await tx.property.update({ where: { id }, data: { featured: body.featured } });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: auth.userId,
        action: 'property.featured_changed',
        entityType: 'Property',
        entityId: id,
        before: { featured: p.featured },
        after: { featured: body.featured },
      });
    });
  }

  @Post('offerings/:id/transition')
  @HttpCode(204)
  @ApiOperation({ summary: 'Move an offering through its lifecycle (permission depends on the move)' })
  async transition(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(transitionSchema)) body: z.output<typeof transitionSchema>,
  ) {
    const o = await this.prisma.tokenOffering.findUnique({ where: { id } });
    if (!o) throw new NotFoundException({ code: 'OFFERING_NOT_FOUND', message: 'Offering not found' });
    const from = o.status as OfferingStatusKey;
    const needed = OFFERING_TRANSITIONS[from][body.to];
    if (!needed) throw new ConflictException({ code: 'INVALID_TRANSITION', message: `An offering cannot go from ${from} to ${body.to}` });
    if (!auth.permissions.has(needed)) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not have permission to do this' });

    const legalApprovalRef = body.legalApprovalRef ?? o.legalApprovalRef;
    if (body.to === 'APPROVED' && !o.isDemo && !legalApprovalRef) {
      throw new BadRequestException({ code: 'LEGAL_APPROVAL_REQUIRED', message: "Record counsel's approval reference to approve a real offering" });
    }
    if (body.to === 'CANCELLED' && (o.tokensSold > 0n || o.tokensReserved > 0n)) {
      throw new ConflictException({ code: 'OFFERING_HAS_INVESTORS', message: 'Refund every subscription before cancelling this offering' });
    }
    if (body.to === 'FUNDED' && o.tokensSold < o.totalTokens) {
      throw new ConflictException({ code: 'OFFERING_NOT_FULLY_SOLD', message: 'Only a fully subscribed offering can be marked funded' });
    }
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.tokenOffering.updateMany({
        where: { id, status: o.status },
        data: {
          status: body.to,
          legalApprovalRef,
          ...(body.to === 'APPROVED' ? { approvedById: auth.userId, approvedAt: new Date() } : {}),
        },
      });
      if (moved.count !== 1) throw new ConflictException({ code: 'INVALID_STATE', message: 'The offering changed meanwhile; reload and try again' });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: auth.userId,
        action: 'offering.status_changed',
        entityType: 'TokenOffering',
        entityId: id,
        before: { status: from, legalApprovalRef: o.legalApprovalRef },
        after: { status: body.to, legalApprovalRef },
      });
    });
  }
}

// -----------------------------------------------------------------------------

const incomeSchema = z.object({
  periodMonth: isoMonth,
  amount: positiveYen,
  notes: z.string().trim().max(500).optional(),
});
const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: positiveYen,
  incurredAt: isoDay,
  description: z.string().trim().min(3).max(255),
});

@ApiTags('admin')
@Staff()
@Controller('admin/properties/:propertyId/finance')
export class AdminFinanceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('finance:record')
  async records(@Param('propertyId', new ParseUUIDPipe()) propertyId: string): Promise<FinanceRecordsDto> {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, name: true } });
    if (!property) throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND', message: 'Property not found' });
    const [income, expenses] = await Promise.all([
      this.prisma.rentalIncome.findMany({ where: { propertyId }, orderBy: [{ periodMonth: 'desc' }, { createdAt: 'desc' }], take: 120 }),
      this.prisma.propertyExpense.findMany({ where: { propertyId }, orderBy: [{ incurredAt: 'desc' }, { createdAt: 'desc' }], take: 200 }),
    ]);
    return {
      property,
      income: income.map((i) => ({
        id: i.id,
        periodMonth: i.periodMonth.toISOString().slice(0, 7),
        amount: toWire(i.amount),
        notes: i.notes,
        createdAt: i.createdAt.toISOString(),
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        category: e.category,
        amount: toWire(e.amount),
        incurredAt: e.incurredAt.toISOString().slice(0, 10),
        description: e.description,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  @Post('income')
  @HttpCode(201)
  @RequirePermissions('finance:record')
  async addIncome(
    @CurrentAuth() auth: AuthContext,
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body(new ZodValidationPipe(incomeSchema)) body: z.output<typeof incomeSchema>,
  ) {
    await this.mustExist(propertyId);
    const row = await this.prisma.$transaction(async (tx) => {
      const r = await tx.rentalIncome.create({
        data: { propertyId, periodMonth: body.periodMonth, amount: body.amount, receivedAt: new Date(), recordedById: auth.userId, notes: body.notes ?? null },
      });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: auth.userId,
        action: 'finance.income_recorded',
        entityType: 'Property',
        entityId: propertyId,
        after: { incomeId: r.id, periodMonth: body.periodMonth.toISOString().slice(0, 7), amount: body.amount },
      });
      return r;
    });
    return { id: row.id };
  }

  @Post('expenses')
  @HttpCode(201)
  @RequirePermissions('finance:record')
  async addExpense(
    @CurrentAuth() auth: AuthContext,
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body(new ZodValidationPipe(expenseSchema)) body: z.output<typeof expenseSchema>,
  ) {
    await this.mustExist(propertyId);
    const row = await this.prisma.$transaction(async (tx) => {
      const r = await tx.propertyExpense.create({
        data: { propertyId, category: body.category, amount: body.amount, incurredAt: body.incurredAt, description: body.description, recordedById: auth.userId },
      });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: auth.userId,
        action: 'finance.expense_recorded',
        entityType: 'Property',
        entityId: propertyId,
        after: { expenseId: r.id, category: body.category, amount: body.amount, incurredAt: body.incurredAt.toISOString().slice(0, 10) },
      });
      return r;
    });
    return { id: row.id };
  }

  private async mustExist(id: string) {
    if (!(await this.prisma.property.count({ where: { id } }))) {
      throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND', message: 'Property not found' });
    }
  }
}

// -----------------------------------------------------------------------------

const prepareSchema = z.object({
  offeringId: z.string().uuid(),
  periodStart: isoDay,
  periodEnd: isoDay,
  reserveAllocation: yenString.default('0'),
  paymentDate: isoDay.optional(),
});
const previewSchema = z.object({
  offeringId: z.string().uuid(),
  periodStart: isoDay,
  periodEnd: isoDay,
  reserveAllocation: yenString.default('0'),
});

@ApiTags('admin')
@Staff()
@Controller('admin/distributions')
export class DistributionsController {
  constructor(private readonly distributions: DistributionsService) {}

  @Get()
  @RequirePermissions('distribution:prepare')
  list() {
    return this.distributions.list();
  }

  @Get('preview')
  @RequirePermissions('distribution:prepare')
  @ApiOperation({ summary: 'Totals the formula would use for a period, without saving anything' })
  async preview(@Query(new ZodValidationPipe(previewSchema)) q: z.output<typeof previewSchema>) {
    const p = await this.distributions.preview(q.offeringId, q.periodStart, q.periodEnd, q.reserveAllocation);
    return {
      grossIncome: toWire(p.grossIncome),
      operatingExpenses: toWire(p.operatingExpenses),
      taxes: toWire(p.taxes),
      fees: toWire(p.fees),
      reserveAllocation: toWire(p.reserveAllocation),
      distributableAmount: p.distributableAmount.toString(),
    };
  }

  @Get(':id')
  @RequirePermissions('distribution:prepare')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.distributions.get(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('distribution:prepare')
  @ApiOperation({ summary: 'Calculate a distribution from recorded income and expenses and freeze holdings' })
  prepare(@CurrentAuth() auth: AuthContext, @Body(new ZodValidationPipe(prepareSchema)) body: z.output<typeof prepareSchema>) {
    return this.distributions.prepare(auth, body);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions('distribution:approve')
  @ApiOperation({ summary: 'Four-eyes approval: the approver must not be the preparer' })
  approve(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.distributions.approve(auth, id);
  }

  @Post(':id/pay')
  @HttpCode(200)
  @RequirePermissions('payment:approve')
  pay(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.distributions.pay(auth, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('distribution:prepare')
  cancel(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(z.object({ reason: z.string().trim().min(10).max(500) }))) body: { reason: string },
  ) {
    return this.distributions.cancel(auth, id, body.reason);
  }
}

// -----------------------------------------------------------------------------

const auditQuerySchema = z.object({
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

@ApiTags('admin')
@Staff()
@Controller('admin/audit')
export class AuditController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('audit:read')
  async list(@Query(new ZodValidationPipe(auditQuerySchema)) q: z.output<typeof auditQuerySchema>): Promise<{ total: number; items: AuditEntryDto[] }> {
    const where = {
      ...(q.action ? { action: { startsWith: q.action } } : {}),
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.entityId ? { entityId: q.entityId } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * 50,
        take: 50,
        include: { actor: { select: { email: true } } },
      }),
    ]);
    return {
      total,
      items: rows.map((r) => ({
        id: r.id.toString(),
        occurredAt: r.occurredAt.toISOString(),
        actorType: r.actorType,
        actorEmail: r.actor?.email ?? null,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        before: r.before,
        after: r.after,
        hash: r.hash,
      })),
    };
  }

  @Get('verify')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Recompute the hash chain end to end' })
  verify(): Promise<AuditVerifyDto> {
    return this.audit.verify(this.prisma);
  }
}
