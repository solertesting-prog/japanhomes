'use client';

import {
  CITIES,
  FUNDING_STATUSES,
  type Paginated,
  PREFECTURES,
  PROPERTY_SORTS,
  PROPERTY_TYPES,
  type PropertyCardDto,
  type PropertyQuery,
  RENTAL_STATUSES,
} from '@jpt/shared';
import {
  Button,
  buttonVariants,
  Checkbox,
  cn,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconFilter,
  IconSearch,
  Input,
  Select,
} from '@jpt/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useId, useRef, useState, useTransition } from 'react';
import { useI18n } from '@/i18n/provider';
import { PropertyCard } from '../property-card';

/* URL state ----------------------------------------------------------------- */

type Params = Record<string, string | undefined>;

function queryToParams(q: PropertyQuery): Params {
  return {
    q: q.q,
    city: q.city?.join(','),
    prefecture: q.prefecture?.join(','),
    type: q.type?.join(','),
    funding: q.funding?.join(','),
    rental: q.rental?.join(','),
    priceMin: q.priceMin?.toString(),
    priceMax: q.priceMax?.toString(),
    minInvestmentMax: q.minInvestmentMax?.toString(),
    yieldMinBps: q.yieldMinBps?.toString(),
    sort: q.sort === 'featured' ? undefined : q.sort,
    page: q.page > 1 ? String(q.page) : undefined,
  };
}

function hrefFor(pathname: string, params: Params): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `${pathname}?${s}` : pathname;
}

function useQueryState(query: PropertyQuery) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const current = queryToParams(query);
  const set = (patch: Params, opts: { resetPage?: boolean } = { resetPage: true }) => {
    const next = { ...current, ...patch, ...(opts.resetPage ? { page: undefined } : {}) };
    startTransition(() => router.replace(hrefFor(pathname, next), { scroll: false }));
  };
  const toggleIn = (key: keyof Params, value: string) => {
    const list = new Set((current[key] ?? '').split(',').filter(Boolean));
    if (list.has(value)) list.delete(value);
    else list.add(value);
    set({ [key]: [...list].join(',') || undefined });
  };
  const clear = () => startTransition(() => router.replace(pathname, { scroll: false }));
  const activeCount = Object.entries(current).filter(([k, v]) => v && !['sort', 'page', 'q'].includes(k)).length;
  return { current, set, toggleIn, clear, pending, pathname, activeCount };
}

/* View ------------------------------------------------------------------------ */

export function MarketplaceView({ query, result }: { query: PropertyQuery; result: Paginated<PropertyCardDto> }) {
  const { t } = useI18n();
  const state = useQueryState(query);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="container-page pb-24 pt-10 md:pt-14">
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl text-ink sm:text-[2.75rem]">{t.market.title}</h1>
        <p className="mt-3 text-ink-2">{t.market.lede}</p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[17rem_1fr]">
        {/* Desktop filters */}
        <aside className="hidden lg:block" aria-label={t.market.filters}>
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pb-6 pr-2">
            <Filters state={state} />
          </div>
        </aside>

        <section aria-live="polite" aria-busy={state.pending}>
          <Toolbar state={state} total={result.total} onOpenFilters={() => setSheetOpen(true)} />
          <div className={cn('mt-6 transition-opacity duration-150', state.pending && 'opacity-50')}>
            {result.items.length === 0 ? (
              <EmptyState onClear={state.clear} />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {result.items.map((p) => (
                  <PropertyCard key={p.id} property={p} />
                ))}
              </div>
            )}
          </div>
          {result.totalPages > 1 && <Pagination result={result} state={state} />}
        </section>
      </div>

      {/* Mobile filter sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t.market.filters}>
          <button type="button" aria-label={t.market.showResults(result.total)} className="absolute inset-0 bg-ink/40" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-paper shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-line px-5">
              <h2 className="font-medium">{t.market.filters}</h2>
              <button type="button" className="grid h-10 w-10 place-items-center" aria-label="Close" onClick={() => setSheetOpen(false)}>
                <IconClose />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6">
              <Filters state={state} />
            </div>
            <div className="border-t border-line p-4">
              <Button className="w-full" onClick={() => setSheetOpen(false)}>
                {t.market.showResults(result.total)}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type QueryState = ReturnType<typeof useQueryState>;

function Toolbar({ state, total, onOpenFilters }: { state: QueryState; total: number; onOpenFilters: () => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState(state.current.q ?? '');
  const first = useRef(true);
  // Keep the box in sync when the URL changes elsewhere (e.g. "Clear filters").
  const urlQ = state.current.q ?? '';
  useEffect(() => {
    setQ((local) => (local.trim() === urlQ ? local : urlQ));
  }, [urlQ]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => {
      if ((state.current.q ?? '') !== q.trim()) state.set({ q: q.trim() || undefined });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <label className="relative flex-1">
        <span className="sr-only">{t.market.search}</span>
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.market.search} className="pl-10" maxLength={80} />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenFilters}
          className={cn(buttonVariants({ variant: 'outline', size: 'md' }), 'lg:hidden')}
        >
          <IconFilter /> {t.market.filters}
          {state.activeCount > 0 && <span className="num rounded-full bg-ink px-1.5 text-xs text-paper">{state.activeCount}</span>}
        </button>
        <label className="flex items-center gap-2">
          <span className="sr-only">{t.market.sort}</span>
          <Select
            value={state.current.sort ?? 'featured'}
            onChange={(e) => state.set({ sort: e.target.value === 'featured' ? undefined : e.target.value })}
            className="w-auto min-w-[13rem]"
          >
            {PROPERTY_SORTS.map((s) => (
              <option key={s} value={s}>
                {t.market.sorts[s]}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <p className="num text-sm text-ink-2 sm:order-first sm:hidden">{t.market.results(total)}</p>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-b border-line py-5 first:pt-0">
      <legend className="mb-3 text-sm font-medium text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

function CheckList({ name, options, selected, onToggle }: {
  name: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <ul className="space-y-2.5">
      {options.map((o) => (
        <li key={o.value}>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-2 hover:text-ink">
            <Checkbox name={name} value={o.value} checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
            {o.label}
          </label>
        </li>
      ))}
    </ul>
  );
}

const PRICE_STEPS = ['10000000', '20000000', '30000000', '50000000', '100000000', '200000000'];
const MIN_INVEST_STEPS = ['30000', '50000', '100000'];
const YIELD_STEPS = [200, 250, 300, 350, 400];

function Filters({ state }: { state: QueryState }) {
  const { t, f } = useI18n();
  const id = useId();
  const sel = (k: keyof Params) => (state.current[k] ?? '').split(',').filter(Boolean);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">{t.market.filters}</p>
        {state.activeCount > 0 && (
          <button type="button" onClick={state.clear} className="text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
            {t.market.clearAll}
          </button>
        )}
      </div>

      <FilterGroup title={t.market.city}>
        <CheckList
          name="city"
          options={CITIES.map((c) => ({ value: c, label: t.cities[c] ?? c }))}
          selected={sel('city')}
          onToggle={(v) => state.toggleIn('city', v)}
        />
      </FilterGroup>

      <FilterGroup title={t.market.type}>
        <CheckList
          name="type"
          options={PROPERTY_TYPES.map((v) => ({ value: v, label: t.types[v] ?? v }))}
          selected={sel('type')}
          onToggle={(v) => state.toggleIn('type', v)}
        />
      </FilterGroup>

      <FilterGroup title={t.market.funding}>
        <div className="flex flex-wrap gap-2">
          {FUNDING_STATUSES.map((s) => {
            const on = sel('funding').includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => state.toggleIn('funding', s)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition-colors',
                  on ? 'border-ink bg-ink text-paper' : 'border-line-strong text-ink-2 hover:border-ink hover:text-ink',
                )}
              >
                {t.status[s]}
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title={t.market.price}>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="mb-1 block text-xs text-ink-3">{t.market.min}</span>
            <Select value={state.current.priceMin ?? ''} onChange={(e) => state.set({ priceMin: e.target.value || undefined })}>
              <option value="">{t.market.anyPrice}</option>
              {PRICE_STEPS.map((v) => (
                <option key={v} value={v}>{f.yenCompact(v)}</option>
              ))}
            </Select>
          </label>
          <label>
            <span className="mb-1 block text-xs text-ink-3">{t.market.max}</span>
            <Select value={state.current.priceMax ?? ''} onChange={(e) => state.set({ priceMax: e.target.value || undefined })}>
              <option value="">{t.market.anyPrice}</option>
              {PRICE_STEPS.map((v) => (
                <option key={v} value={v} disabled={!!state.current.priceMin && BigInt(v) < BigInt(state.current.priceMin)}>
                  {f.yenCompact(v)}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </FilterGroup>

      <FilterGroup title={t.market.minInvestment}>
        <label htmlFor={`${id}-mi`} className="sr-only">{t.market.minInvestment}</label>
        <Select id={`${id}-mi`} value={state.current.minInvestmentMax ?? ''} onChange={(e) => state.set({ minInvestmentMax: e.target.value || undefined })}>
          <option value="">{t.market.any}</option>
          {MIN_INVEST_STEPS.map((v) => (
            <option key={v} value={v}>{f.yen(v)}</option>
          ))}
        </Select>
      </FilterGroup>

      <FilterGroup title={t.market.yieldMin}>
        <label htmlFor={`${id}-y`} className="sr-only">{t.market.yieldMin}</label>
        <Select id={`${id}-y`} value={state.current.yieldMinBps ?? ''} onChange={(e) => state.set({ yieldMinBps: e.target.value || undefined })}>
          <option value="">{t.market.any}</option>
          {YIELD_STEPS.map((v) => (
            <option key={v} value={String(v)}>{f.pct(v, 1)}</option>
          ))}
        </Select>
      </FilterGroup>

      <FilterGroup title={t.market.rental}>
        <CheckList
          name="rental"
          options={RENTAL_STATUSES.map((v) => ({ value: v, label: t.rental[v] ?? v }))}
          selected={sel('rental')}
          onToggle={(v) => state.toggleIn('rental', v)}
        />
      </FilterGroup>

      <details className="group py-5">
        <summary className="cursor-pointer list-none text-sm font-medium text-ink marker:hidden">
          {t.market.prefecture}
          <span className="ml-1 text-ink-3 group-open:hidden">+</span>
        </summary>
        <div className="mt-3">
          <CheckList
            name="prefecture"
            options={PREFECTURES.map((v) => ({ value: v, label: t.prefectures[v] ?? v }))}
            selected={sel('prefecture')}
            onToggle={(v) => state.toggleIn('prefecture', v)}
          />
        </div>
      </details>
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  const { t } = useI18n();
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-16 text-center">
      <h2 className="font-display text-xl text-ink">{t.market.emptyTitle}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-2">{t.market.emptyBody}</p>
      <Button variant="outline" className="mt-6" onClick={onClear}>
        {t.market.clearAll}
      </Button>
    </div>
  );
}

function Pagination({ result, state }: { result: Paginated<PropertyCardDto>; state: QueryState }) {
  const { t } = useI18n();
  const href = (page: number) => hrefFor(state.pathname, { ...state.current, page: page > 1 ? String(page) : undefined });
  const linkCls = cn(buttonVariants({ variant: 'outline', size: 'icon' }));
  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-4">
      {result.page > 1 ? (
        <Link href={href(result.page - 1)} className={linkCls} aria-label={t.market.prev} scroll={false}>
          <IconChevronLeft />
        </Link>
      ) : (
        <span className={cn(linkCls, 'opacity-40')} aria-hidden><IconChevronLeft /></span>
      )}
      <span className="num text-sm text-ink-2">{t.market.page(result.page, result.totalPages)}</span>
      {result.page < result.totalPages ? (
        <Link href={href(result.page + 1)} className={linkCls} aria-label={t.market.next} scroll={false}>
          <IconChevronRight />
        </Link>
      ) : (
        <span className={cn(linkCls, 'opacity-40')} aria-hidden><IconChevronRight /></span>
      )}
    </nav>
  );
}
