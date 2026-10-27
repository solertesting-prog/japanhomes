import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { computeOfferingMetrics, mulDiv, ratioToPpm, toWire } from '@jpt/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentAuth } from '../auth/decorators';
import type { AuthContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';

const exportSchema = z.object({ format: z.enum(['json', 'csv']).default('json') });

/** Investor's own data only: every query is scoped by the session's userId. */
@ApiTags('me')
@Controller('me')
export class PortfolioController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('portfolio')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Holdings, invested capital, received and projected income (projections labelled)' })
  async portfolio(@CurrentAuth() auth: AuthContext) {
    const investments = await this.prisma.investment.findMany({
      where: { userId: auth.userId, tokens: { gt: 0 } },
      include: {
        offering: {
          include: {
            property: { include: { financials: { where: { isCurrent: true }, take: 1 }, valuations: { orderBy: { appraisedAt: 'desc' }, take: 1 } } },
          },
        },
        distributionAllocations: { where: { status: 'PAID' } },
      },
      orderBy: { firstInvestedAt: 'asc' },
    });

    let invested = 0n;
    let estimatedValue = 0n;
    let received = 0n;
    let projectedAnnual = 0n;
    const holdings = investments.map((inv) => {
      const o = inv.offering;
      const p = o.property;
      const f = p.financials[0];
      const valuation = p.valuations[0]?.appraisedValue ?? null;
      const paid = inv.distributionAllocations.reduce((a, d) => a + d.netAmount, 0n);
      // Estimated value: holder's share of the latest appraisal (no market price exists).
      const value = valuation !== null && f ? mulDiv(valuation + f.reserves, inv.tokens, o.totalTokens) : inv.investedAmount;
      const metrics = f
        ? computeOfferingMetrics({ ...f, totalTokens: o.totalTokens })
        : null;
      const projected = metrics && metrics.estimatedDistributable > 0n ? mulDiv(metrics.estimatedDistributable, inv.tokens, o.totalTokens) : 0n;
      invested += inv.investedAmount;
      estimatedValue += value;
      received += paid;
      projectedAnnual += projected;
      return {
        offeringId: o.id,
        property: { slug: p.slug, name: p.name, city: p.city.toLowerCase(), type: p.type, isDemo: p.isDemo },
        tokenSymbol: o.tokenSymbol,
        tokens: toWire(inv.tokens),
        investedAmount: toWire(inv.investedAmount),
        ownershipPpm: toWire(ratioToPpm(inv.tokens, o.totalTokens)),
        estimatedValue: toWire(value),
        distributionsReceived: toWire(paid),
        projectedAnnualDistribution: toWire(projected),
        offeringStatus: o.status,
        firstInvestedAt: inv.firstInvestedAt.toISOString(),
      };
    });

    const byCity = new Map<string, bigint>();
    for (const h of holdings) byCity.set(h.property.city, (byCity.get(h.property.city) ?? 0n) + BigInt(h.investedAmount));

    return {
      totals: {
        investedAmount: toWire(invested),
        estimatedValue: toWire(estimatedValue),
        distributionsReceived: toWire(received),
        projectedAnnualDistribution: toWire(projectedAnnual),
        properties: holdings.length,
      },
      allocationByCity: [...byCity.entries()].map(([city, amount]) => ({ city, amount: toWire(amount) })),
      holdings,
      notes: {
        estimatedValue: 'Share of the latest independent appraisal plus reserves. Not a market price; tokens may not be sellable.',
        projected: 'Projection from underwriting assumptions, not a promise.',
      },
    };
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Activity history; ?format=csv for a download' })
  async transactions(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(exportSchema)) q: z.output<typeof exportSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rows = await this.prisma.transaction.findMany({
      where: { userId: auth.userId },
      orderBy: { occurredAt: 'desc' },
      take: 1000,
      include: { offering: { select: { tokenSymbol: true } } },
    });
    const items = rows.map((r) => ({
      occurredAt: r.occurredAt.toISOString(),
      type: r.type,
      status: r.status,
      reference: r.reference,
      token: r.offering?.tokenSymbol ?? null,
      tokens: r.tokens === null ? null : toWire(r.tokens),
      amount: r.amount === null ? null : toWire(r.amount),
      currency: 'JPY',
    }));
    if (q.format === 'json') return { items };

    const esc = (v: string | null) => {
      if (v === null) return '';
      // Neutralise spreadsheet formula injection, then CSV-quote.
      const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
      return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const header = 'occurred_at,type,status,reference,token,tokens,amount_jpy';
    const lines = items.map((i) => [i.occurredAt, i.type, i.status, i.reference, i.token, i.tokens, i.amount].map(esc).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="jpt-transactions.csv"');
    res.setHeader('Cache-Control', 'private, no-store');
    return `﻿${[header, ...lines].join('\r\n')}\r\n`;
  }
}
