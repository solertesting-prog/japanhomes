'use client';

import type { PropertyCardDto } from '@jpt/shared';
import Link from 'next/link';
import { useI18n } from '@/i18n/provider';

const NICE_STEPS = [10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000];

/**
 * The hero image: a building facade whose windows are the offering's tokens.
 * Windows already subscribed are vermilion. Data comes from the API, so the
 * picture is a true chart of the round, not decoration.
 */
export function TokenFacade({ property: p }: { property: PropertyCardDto }) {
  const { t, f } = useI18n();
  const total = BigInt(p.totalTokens);
  const sold = total - BigInt(p.tokensAvailable);
  const perCell = BigInt(NICE_STEPS.find((s) => total / BigInt(s) <= 320n) ?? 10_000);
  const cellCount = Number((total + perCell - 1n) / perCell);
  const filled = Number(sold / perCell);

  const cols = 15;
  const rows = Math.ceil(cellCount / cols);
  const cell = 14;
  const gap = 5;
  const pad = 22;
  const w = pad * 2 + cols * cell + (cols - 1) * gap;
  const bodyTop = 34;
  const h = bodyTop + pad + rows * (cell + gap) + 40;

  const cells = [];
  for (let i = 0; i < cellCount; i++) {
    // Fill bottom-up, left to right, like floors being let.
    const row = rows - 1 - Math.floor(i / cols);
    const col = i % cols;
    const isFilled = i < filled;
    cells.push(
      <rect
        key={i}
        className="facade-cell"
        data-filled={isFilled}
        x={pad + col * (cell + gap)}
        y={bodyTop + pad + row * (cell + gap)}
        width={cell}
        height={cell}
        rx={1.5}
        fill={isFilled ? 'var(--color-shu)' : 'var(--color-washi-deep)'}
        style={isFilled ? { animationDelay: `${Math.min(i * 4, 1400)}ms` } : undefined}
      />,
    );
  }

  return (
    <figure className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${p.name}: ${t.hero.facadeFunded(f.pct(p.fundedBps, 1))}`}
      >
        {/* roof */}
        <rect x={8} y={14} width={w - 16} height={8} fill="var(--color-ink)" />
        <rect x={pad} y={22} width={w - pad * 2} height={bodyTop - 22} fill="var(--color-ink)" opacity="0.12" />
        {/* body */}
        <rect x={12} y={bodyTop} width={w - 24} height={h - bodyTop - 26} fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="1.5" />
        {cells}
        {/* entrance and ground */}
        <rect x={w / 2 - 22} y={h - 50} width={44} height={24} fill="var(--color-ink)" />
        <line x1={0} y1={h - 25.5} x2={w} y2={h - 25.5} stroke="var(--color-ink)" strokeWidth="1.5" />
      </svg>
      <figcaption className="mt-4 flex flex-col gap-1 text-sm text-ink-2 sm:flex-row sm:items-baseline sm:justify-between">
        <Link href={`/properties/${p.slug}`} className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-shu">
          {p.name}
        </Link>
        <span className="num text-ink">{t.hero.facadeFunded(f.pct(p.fundedBps, 1))}</span>
      </figcaption>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-3">
        {t.hero.facadeCaption(f.int(total), f.yen(p.tokenPrice), f.int(perCell))}
      </p>
    </figure>
  );
}
