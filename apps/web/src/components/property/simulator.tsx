'use client';

import { type PropertyDetailDto, simulateInvestment } from '@jpt/shared';
import { cn, IconInfo, Input } from '@jpt/ui';
import { useId, useMemo, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { financialsFromDto } from '@/lib/financials';

const QUICK = ['50000', '100000', '500000', '1000000'];

/**
 * Runs the same `simulateInvestment` as POST /v1/properties/:slug/simulate,
 * in the browser, so the figures update as the user types. The API endpoint
 * remains the reference for any server-side use.
 */
export function InvestmentSimulator({ property: p }: { property: PropertyDetailDto }) {
  const { t, f } = useI18n();
  const id = useId();
  const [raw, setRaw] = useState('100000');
  const digits = raw.replace(/\D/g, '').slice(0, 13);

  const result = useMemo(() => {
    return simulateInvestment({
      financials: financialsFromDto(p),
      tokensSold: BigInt(p.token.tokensSold),
      amount: BigInt(digits || '0'),
      minimumInvestment: BigInt(p.minimumInvestment),
      maximumInvestment: p.maximumInvestment === null ? null : BigInt(p.maximumInvestment),
    });
  }, [p, digits]);

  const issueText = result.issues.map((issue) => {
    const msg = t.simulator.issues[issue];
    switch (issue) {
      case 'BELOW_MINIMUM':
        return { issue, text: (msg as (s: string) => string)(f.yen(p.minimumInvestment)), blocking: true };
      case 'ABOVE_MAXIMUM':
        return { issue, text: (msg as (s: string) => string)(f.yen(p.maximumInvestment ?? '0')), blocking: true };
      case 'EXCEEDS_AVAILABLE':
        return { issue, text: (msg as (s: string) => string)(f.int(result.tokensAvailable)), blocking: true };
      case 'LESS_THAN_ONE_TOKEN':
        return { issue, text: (msg as (s: string) => string)(f.yen(result.tokenPrice)), blocking: true };
      default:
        return { issue, text: msg as string, blocking: false };
    }
  });

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-[var(--radius-card)] border border-line bg-paper">
      <div className="border-b border-line p-5 sm:p-6">
        <h2 id={`${id}-title`} className="font-display text-xl text-ink">
          {t.simulator.title}
        </h2>
        <p className="mt-1 text-sm text-ink-2">{t.simulator.lede}</p>

        <label htmlFor={`${id}-amount`} className="mt-5 block text-sm font-medium text-ink">
          {t.simulator.amount}
        </label>
        <div className="relative mt-2">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">¥</span>
          <Input
            id={`${id}-amount`}
            inputMode="numeric"
            autoComplete="off"
            value={digits ? f.int(digits) : ''}
            onChange={(e) => setRaw(e.target.value)}
            className="num h-12 pl-8 text-lg"
            aria-describedby={`${id}-issues`}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setRaw(v)}
              aria-pressed={digits === v}
              className={cn(
                'num rounded-full border px-3 py-1 text-sm transition-colors',
                digits === v ? 'border-ink bg-ink text-paper' : 'border-line-strong text-ink-2 hover:border-ink',
              )}
            >
              {f.yen(v)}
            </button>
          ))}
        </div>
        <ul id={`${id}-issues`} className="mt-3 space-y-1" aria-live="polite">
          {issueText.map(({ issue, text, blocking }) => (
            <li key={issue} className={cn('flex gap-2 text-sm', blocking ? 'text-shu-deep' : 'text-ink-2')}>
              <IconInfo size={16} className="mt-0.5 shrink-0" />
              {text}
            </li>
          ))}
        </ul>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-5 text-sm sm:p-6">
        <Row label={t.simulator.tokens} value={f.int(result.tokens)} strong />
        <Row label={t.simulator.share} value={f.ppm(result.ownershipPpm)} />
        <Row label={t.simulator.invested} value={f.yen(result.investedAmount)} />
        <Row label={t.simulator.fee(f.pct(p.financials.subscriptionFeeBps, 1))} value={f.yen(result.subscriptionFee)} />
        {result.unusedAmount > 0n && <Row label={t.simulator.unused} value={f.yen(result.unusedAmount)} />}
        <Row label={t.simulator.totalPayable} value={f.yen(result.totalPayable)} strong />
        <Row label={t.simulator.platformFeeShare} value={f.yen(result.annualPlatformFeeShare)} />
      </dl>

      <div className="border-t border-line p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {result.scenarios.map((s) => (
            <div
              key={s.key}
              className={cn('rounded-lg border p-4', s.key === 'base' ? 'border-ink' : 'border-line')}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">{t.property.scenario[s.key]}</p>
                <span className="rounded-sm border border-dashed border-line-strong px-1.5 text-[0.6875rem] text-ink-3">
                  {t.simulator.projectionTag}
                </span>
              </div>
              <p className="num mt-3 font-display text-2xl text-ink">{f.yen(s.annualDistribution)}</p>
              <p className="text-xs text-ink-3">{t.simulator.annual}</p>
              <dl className="mt-3 space-y-1 text-xs text-ink-2">
                <div className="flex justify-between">
                  <dt>{t.simulator.monthly}</dt>
                  <dd className="num">{f.yen(s.monthlyEquivalent)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t.simulator.yieldOnInvested}</dt>
                  <dd className="num">{f.pct(s.yieldOnInvestedBps)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={cn('num mt-0.5', strong ? 'text-base font-medium text-ink' : 'text-ink')}>{value}</dd>
    </div>
  );
}
