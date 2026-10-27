import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import { CurrentAuth, RequirePermissions, Staff } from '../auth/decorators';
import { stableId } from '@jpt/database';
import { STAFF_ROLES } from '@jpt/shared';
import type { AuthContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';

const roleSchema = z.object({ role: z.enum(STAFF_ROLES), grant: z.boolean() });
const searchSchema = z.object({ q: z.string().trim().max(120).optional(), page: z.coerce.number().int().min(1).default(1) });

@ApiTags('admin')
@Staff()
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('user:read')
  @ApiOperation({ summary: 'Search users (email contains q)' })
  async search(@Query(new ZodValidationPipe(searchSchema)) q: z.output<typeof searchSchema>) {
    const where = q.q ? { email: { contains: q.q.toLowerCase() } } : {};
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * 25,
        take: 25,
        include: { roles: { include: { role: true } }, kycVerifications: { orderBy: { createdAt: 'desc' }, take: 1 }, profile: true },
      }),
    ]);
    return {
      total,
      items: users.map((u) => ({
        id: u.id,
        email: u.email,
        status: u.status,
        emailVerified: u.emailVerifiedAt !== null,
        mfaEnabled: u.mfaEnabled,
        roles: u.roles.map((r) => r.role.key),
        kycStatus: u.kycVerifications[0]?.status ?? 'NOT_STARTED',
        countryOfResidence: u.profile?.countryOfResidence ?? null,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      })),
    };
  }

  @Post(':id/block')
  @HttpCode(204)
  @RequirePermissions('user:block')
  block(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.setStatus(auth, id, 'SUSPENDED');
  }

  @Post(':id/unblock')
  @HttpCode(204)
  @RequirePermissions('user:block')
  unblock(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.setStatus(auth, id, 'ACTIVE');
  }

  @Post(':id/roles')
  @HttpCode(204)
  @RequirePermissions('role:assign')
  @ApiOperation({ summary: 'Grant or revoke a staff role' })
  async roles(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(roleSchema)) body: z.output<typeof roleSchema>,
  ) {
    if (id === auth.userId) throw new BadRequestException({ code: 'SELF_ACTION', message: 'You cannot change your own roles' });
    const user = await this.prisma.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    const roleId = stableId('role', body.role);
    const has = user.roles.some((r) => r.role.key === body.role);
    if (has === body.grant) return;
    await this.prisma.$transaction(async (tx) => {
      if (body.grant) await tx.userRole.create({ data: { userId: id, roleId, grantedById: auth.userId } });
      else await tx.userRole.delete({ where: { userId_roleId: { userId: id, roleId } } });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: auth.userId,
        action: body.grant ? 'user.role_granted' : 'user.role_revoked',
        entityType: 'User',
        entityId: id,
        before: { roles: user.roles.map((r) => r.role.key) },
        after: { role: body.role, grant: body.grant },
      });
    });
    // Privilege changes take effect on the next request; revoke sessions so a
    // removed role cannot linger in an open tab.
    if (!body.grant) await this.sessions.revokeAllForUser(id);
  }

  private async setStatus(auth: AuthContext, id: string, status: 'ACTIVE' | 'SUSPENDED') {
    if (id === auth.userId) throw new BadRequestException({ code: 'SELF_ACTION', message: 'You cannot change your own status' });
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status } });
      await this.audit.record(tx, {
        actorType: 'USER',
        actorUserId: auth.userId,
        action: status === 'SUSPENDED' ? 'user.blocked' : 'user.unblocked',
        entityType: 'User',
        entityId: id,
        before: { status: user.status },
        after: { status },
      });
    });
    if (status === 'SUSPENDED') await this.sessions.revokeAllForUser(id);
  }
}
