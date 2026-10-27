'use client';

import {
  type AdminOfferingDto,
  type AdminPropertyDto,
  EXPENSE_CATEGORIES,
  expenseBucket,
  type ExpenseCategoryKey,
  type FinanceRecordsDto,
  OFFERING_TRANSITIONS,
  type OfferingStatusKey,
} from '@jpt/shared';
import { Badge, Button, buttonVariants, Select } from '@jpt/ui';
import Link from 'next/link';
import { useState } from 'react';
import { Field, Notice } from '@/components/app/ui';
import { useI18n } from '@/i18n/provider';
import { api } from '@/lib/client-api';
import { LoadState, Table, td, tdNum, useAction, useAdminData, useAdminError, useHasPermission } from './shell';

const OFFERING_TONE: Record<OfferingStatusKey, 'neutral' | 'open' | 'soon' | 'funded' | 'closed' | 'warning'> = {
  DRAFT: 'neutral',
  LEGAL_REVIEW: 'warning',
  APPROVED: 'soon',
  COMING_SOON: 'soon',
  OPEN: 'open',
  FUNDED: 'funded',
  CLOSED: 'closed',
  CANCELLED: 'closed',
};

export function AdminProperties() {
  const { t } = useI18n();
  const p = t.admin.properties;
  const can = useHasPermission();
  const { data, error, loading, reload } = useAdminData<AdminPropertyDto[]>('/admin/properties');
  const action = useAction(reload);
  const errorText = useAdminError();

  if (!data) return <LoadState loading={loading} error={error} onRetry={reload} />;
  return (
    <div className="space-y-6">
      <Notice>{p.noCreate}</Notice>
      {action.error ? <Notice tone="error">{errorText(action.error)}</Notice> : null}
      <ul className="space-y-4">
        {data.map((prop) => (
          <li key={prop.id} className="rounded-lg border border-line p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-ink">
                  <Link href={`/properties/${prop.slug}`} className="hover:underline">
                    {prop.name}
                  </Link>
                </p>
                <p className="mt-0.5 text-xs text-ink-3">{prop.city}</p>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={prop.status === 'PUBLISHED' ? 'funded' : 'neutral'}>{p.visibility[prop.status]}</Badge>
                  {prop.featured && <Badge tone="soon">{p.featured}</Badge>}
                  {prop.isDemo && <Badge tone="demo">DEMO</Badge>}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {can('property:publish') && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={action.pending}
                    onClick={() =>
                      action.run(() =>
                        api(`/admin/properties/${prop.id}/visibility`, {
                          body: { status: prop.status === 'PUBLISHED' ? 'UNPUBLISHED' : 'PUBLISHED' },
                        }),
                      )
                    }
                  >
                    {prop.status === 'PUBLISHED' ? p.unpublish : p.publish}
                  </Button>
                )}
                {can('property:write') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={action.pending}
                    onClick={() => action.run(() => api(`/admin/properties/${prop.id}/featured`, { body: { featured: !prop.featured } }))}
                  >
                    {prop.featured ? p.unfeature : p.feature}
                  </Button>
                )}
                {can('finance:record') && (
                  <Link href={`/admin/properties/${prop.id}/finance`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    {p.finance}
                  </Link>
                )}
              </div>
            </div>
            {prop.offerings.length > 0 && (
              <div className="mt-4">
                <Table head={[p.offering, t.admin.common.status, p.sold, p.investors, '']} minWidth="40rem">
                  {prop.offerings.map((o) => (
                    <OfferingRow key={o.id} offering={o} onChanged={reload} />
                  ))}
                </Table>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function OfferingRow({ offering: o, onChanged }: { offering: AdminOfferingDto; onChanged: () => void }) {
  const { t, f } = useI18n();
  const p = t.admin.properties;
  const can = useHasPermission();
  const [to, setTo] = useState<OfferingStatusKey | ''>('');
  const [legalRef, setLegalRef] = useState(o.legalApprovalRef ?? '');
  const action = useAction(() => {
    setTo('');
    onChanged();
  });
  const errorText = useAdminError();
  const moves = (Object.entries(OFFERING_TRANSITIONS[o.status]) as Array<[OfferingStatusKey, string]>).filter(([, perm]) => can(perm));
  const needsRef = to === 'APPROVED' && !o.isDemo;

  return (
    <tr className="border-b border-line">
      <td className={td}>
        <span className="num font-medium">{o.tokenSymbol}</span>
        <span className="mt-0.5 block text-xs text-ink-3">{f.yen(o.tokenPrice)} / token</span>
      </td>
      <td className={td}>
        <Badge tone={OFFERING_TONE[o.status]}>{p.offeringStatus[o.status]}</Badge>
      </td>
      <td className={tdNum}>
        {f.int(o.tokensSold)} / {f.int(o.totalTokens)}
        {o.tokensReserved !== '0' && <span className="block text-xs text-ink-3">+{f.int(o.tokensReserved)}</span>}
      </td>
      <td className={tdNum}>{f.int(o.investors)}</td>
      <td className={td}>
        {moves.length > 0 && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!to) return;
              void action.run(() =>
                api(`/admin/offerings/${o.id}/transition`, {
                  body: { to, ...(legalRef.trim() ? { legalApprovalRef: legalRef.trim() } : {}) },
                }),
              );
            }}
          >
            <Select value={to} onChange={(e) => setTo(e.target.value as OfferingStatusKey | '')} className="h-9 w-40 text-sm" aria-label={p.moveTo}>
              <option value="">{p.moveTo}</option>
              {moves.map(([status]) => (
                <option key={status} value={status}>
                  {p.offeringStatus[status]}
                </option>
              ))}
            </Select>
            {needsRef && (
              <div className="w-56">
                <Field label={p.legalRef} hint={p.legalRefHint} value={legalRef} onChange={(e) => setLegalRef(e.target.value)} />
              </div>
            )}
            <Button size="sm" type="submit" disabled={!to || action.pending || (needsRef && legalRef.trim().length < 3)}>
              {t.admin.common.confirm}
            </Button>
          </form>
        )}
        {action.error ? <p className="mt-1 text-xs text-shu-deep">{errorText(action.error)}</p> : null}
      </td>
    </tr>
  );
}

// -----------------------------------------------------------------------------

const today = () => new Date().toISOString().slice(0, 10);

export function AdminFinance({ propertyId }: { propertyId: string }) {
  const { t, f } = useI18n();
  const fi = t.admin.finance;
  const { data, error, loading, reload } = useAdminData<FinanceRecordsDto>(`/admin/properties/${propertyId}/finance`);
  const errorText = useAdminError();

  const [income, setIncome] = useState({ periodMonth: today().slice(0, 7), amount: '', notes: '' });
  const incomeAction = useAction(() => {
    setIncome((s) => ({ ...s, amount: '', notes: '' }));
    reload();
  });
  const [expense, setExpense] = useState<{ category: ExpenseCategoryKey; amount: string; incurredAt: string; description: string }>({
    category: 'BUILDING_MANAGEMENT',
    amount: '',
    incurredAt: today(),
    description: '',
  });
  const expenseAction = useAction(() => {
    setExpense((s) => ({ ...s, amount: '', description: '' }));
    reload();
  });
  const yenOk = (v: string) => /^\d{1,15}$/.test(v) && BigInt(v) > 0n;

  if (!data) return <LoadState loading={loading} error={error} onRetry={reload} />;
  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/properties" className="text-sm text-ink-3 hover:text-ink">
          ← {t.admin.common.back}
        </Link>
        <h2 className="mt-2 font-display text-xl text-ink">
          {fi.title} · {data.property.name}
        </h2>
        <p className="mt-2 text-sm text-ink-3">{fi.immutable}</p>
      </div>

      <section className="grid gap-8 lg:grid-cols-2">
        <form
          className="space-y-3 rounded-lg border border-line p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void incomeAction.run(() =>
              api(`/admin/properties/${propertyId}/finance/income`, {
                body: { periodMonth: income.periodMonth, amount: income.amount, ...(income.notes.trim() ? { notes: income.notes.trim() } : {}) },
              }),
            );
          }}
        >
          <h3 className="font-medium text-ink">{fi.addIncome}</h3>
          <Field label={fi.month} type="month" required value={income.periodMonth} onChange={(e) => setIncome({ ...income, periodMonth: e.target.value })} />
          <Field label={fi.amountYen} inputMode="numeric" required value={income.amount} onChange={(e) => setIncome({ ...income, amount: e.target.value.replace(/\D/g, '') })} />
          <Field label={fi.notes} value={income.notes} maxLength={500} onChange={(e) => setIncome({ ...income, notes: e.target.value })} />
          {incomeAction.error ? <Notice tone="error">{errorText(incomeAction.error)}</Notice> : null}
          <Button type="submit" size="sm" disabled={incomeAction.pending || !yenOk(income.amount) || !income.periodMonth}>
            {t.admin.common.save}
          </Button>
        </form>

        <form
          className="space-y-3 rounded-lg border border-line p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void expenseAction.run(() =>
              api(`/admin/properties/${propertyId}/finance/expenses`, { body: { ...expense, description: expense.description.trim() } }),
            );
          }}
        >
          <h3 className="font-medium text-ink">{fi.addExpense}</h3>
          <label className="block text-sm font-medium text-ink">
            {fi.category}
            <Select
              className="mt-1.5"
              value={expense.category}
              onChange={(e) => setExpense({ ...expense, category: e.target.value as ExpenseCategoryKey })}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {fi.categories[c]}
                </option>
              ))}
            </Select>
            <span className="mt-1 block text-xs font-normal text-ink-3">{fi.bucket[expenseBucket(expense.category)]}</span>
          </label>
          <Field label={fi.incurredAt} type="date" required value={expense.incurredAt} onChange={(e) => setExpense({ ...expense, incurredAt: e.target.value })} />
          <Field label={fi.amountYen} inputMode="numeric" required value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value.replace(/\D/g, '') })} />
          <Field label={fi.description} required minLength={3} maxLength={255} value={expense.description} onChange={(e) => setExpense({ ...expense, description: e.target.value })} />
          {expenseAction.error ? <Notice tone="error">{errorText(expenseAction.error)}</Notice> : null}
          <Button type="submit" size="sm" disabled={expenseAction.pending || !yenOk(expense.amount) || expense.description.trim().length < 3}>
            {t.admin.common.save}
          </Button>
        </form>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-medium text-ink">{fi.income}</h3>
          {data.income.length === 0 ? (
            <p className="text-sm text-ink-3">{t.admin.common.empty}</p>
          ) : (
            <Table head={[fi.month, t.admin.common.amount, fi.notes]} minWidth="24rem">
              {data.income.map((i) => (
                <tr key={i.id} className="border-b border-line">
                  <td className={td}>{f.month(`${i.periodMonth}-01T00:00:00Z`)}</td>
                  <td className={tdNum}>{f.yen(i.amount)}</td>
                  <td className={`${td} text-ink-3`}>{i.notes ?? ''}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
        <div>
          <h3 className="mb-2 font-medium text-ink">{fi.expenses}</h3>
          {data.expenses.length === 0 ? (
            <p className="text-sm text-ink-3">{t.admin.common.empty}</p>
          ) : (
            <Table head={[fi.incurredAt, fi.category, t.admin.common.amount]} minWidth="24rem">
              {data.expenses.map((e) => (
                <tr key={e.id} className="border-b border-line">
                  <td className={td}>{f.date(`${e.incurredAt}T00:00:00Z`)}</td>
                  <td className={td}>
                    {fi.categories[e.category]}
                    <span className="block text-xs text-ink-3">{e.description}</span>
                  </td>
                  <td className={tdNum}>{f.yen(e.amount)}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
