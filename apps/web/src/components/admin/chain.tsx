'use client';

import type { ChainOverviewDto, ChainTickDto } from '@jpt/shared';
import { Badge, Button } from '@jpt/ui';
import { useState } from 'react';
import { Notice } from '@/components/app/ui';
import { useI18n } from '@/i18n/provider';
import { api } from '@/lib/client-api';
import { LoadState, Table, td, tdNum, useAction, useAdminData, useAdminError } from './shell';

const short = (addr: string | null) => (addr ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : '—');

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));
}

export function AdminChain() {
  const { t, f } = useI18n();
  const c = t.admin.chain;
  const { data, error, loading, reload } = useAdminData<ChainOverviewDto>('/admin/chain');
  const [ran, setRan] = useState<ChainTickDto | null>(null);
  const action = useAction(reload);
  const errorText = useAdminError();

  if (!data) return <LoadState loading={loading} error={error} onRetry={reload} />;
  const g = data.gateway;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <dl className="grid grid-cols-3 gap-x-8 gap-y-1 text-sm">
          <dt className="text-xs text-ink-3">{c.network}</dt>
          <dt className="text-xs text-ink-3">{c.head}</dt>
          <dt className="text-xs text-ink-3">{c.confirmations}</dt>
          <dd className="font-medium text-ink">{g.network}</dd>
          <dd className="num text-ink">{f.int(g.head)}</dd>
          <dd className="num text-ink">{g.confirmations}</dd>
        </dl>
        <Button
          size="sm"
          disabled={action.pending}
          onClick={() =>
            action.run(async () => {
              setRan(await api<ChainTickDto>('/admin/chain/tick', { method: 'POST' }));
            })
          }
        >
          {c.runNow}
        </Button>
      </div>
      {g.kind === 'simulated' && <Notice>{c.simulatedNote}</Notice>}
      {ran && <Notice tone="success">{fill(c.ran, { ...ran })}</Notice>}
      {action.error ? <Notice tone="error">{errorText(action.error)}</Notice> : null}

      <ul className="space-y-4">
        {data.offerings.map((o) => {
          const deployed = o.contract?.status === 'DEPLOYED';
          const rec = o.reconciliation;
          return (
            <li key={o.offeringId} className="rounded-lg border border-line p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">
                    <span className="num">{o.tokenSymbol}</span> · {o.propertyName}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    <Badge>{t.admin.properties.offeringStatus[o.offeringStatus]}</Badge>
                    {o.isDemo && <Badge tone="demo">DEMO</Badge>}
                    <Badge tone={deployed ? 'funded' : 'neutral'}>{deployed ? c.deployed : c.notDeployed}</Badge>
                  </p>
                </div>
                {!deployed && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={action.pending}
                    onClick={() => action.run(() => api(`/admin/offerings/${o.offeringId}/contract`, { method: 'POST' }))}
                  >
                    {c.deploy}
                  </Button>
                )}
              </div>

              {deployed && o.contract && (
                <dl className="mt-4 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-ink-3">{c.token}</dt>
                    <dd className="num break-all text-ink-2" title={o.contract.address ?? ''}>{short(o.contract.address)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">{c.registry}</dt>
                    <dd className="num break-all text-ink-2" title={o.contract.identityRegistry ?? ''}>{short(o.contract.identityRegistry)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">{c.compliance}</dt>
                    <dd className="num break-all text-ink-2" title={o.contract.complianceModule ?? ''}>{short(o.contract.complianceModule)}</dd>
                  </div>
                </dl>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-ink-3">{c.queue}</p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {(['PENDING', 'MINT_SUBMITTED', 'MINTED', 'FAILED'] as const).map((s) => (
                      <Badge key={s} tone={s === 'FAILED' && o.allocations[s] > 0 ? 'open' : s === 'MINTED' ? 'funded' : 'neutral'}>
                        {c.statuses[s]} <span className="num">{o.allocations[s]}</span>
                      </Badge>
                    ))}
                  </p>
                  <p className="mt-2 text-xs text-ink-2">
                    {c.minted}: <span className="num">{f.int(o.mintedTokens)}</span> · {c.sold}:{' '}
                    <span className="num">{f.int(o.tokensSold)}</span> / <span className="num">{f.int(o.totalTokens)}</span>
                  </p>
                  {o.isDemo && <p className="mt-1 text-xs text-ink-3">{c.soldNote}</p>}
                </div>
                {deployed && (
                  <div>
                    <p className="text-xs text-ink-3">{c.reconciliation}</p>
                    {!rec ? (
                      <p className="mt-1 text-sm text-ink-3">{c.reconNever}</p>
                    ) : (
                      <>
                        <p className={`mt-1 text-sm ${rec.ok ? 'text-matcha' : 'text-shu-deep'}`}>{rec.ok ? c.reconOk : c.reconBad}</p>
                        <p className="mt-1 text-xs text-ink-2">
                          {c.supply}: <span className="num">{f.int(rec.expectedSupply)}</span> / <span className="num">{f.int(rec.onChainSupply)}</span>
                        </p>
                        {rec.mismatches.length > 0 && (
                          <ul className="mt-2 space-y-1 text-xs">
                            {rec.mismatches.map((m) => (
                              <li key={m.wallet}>
                                <span className="num">{short(m.wallet)}</span> {m.email ? `(${m.email})` : ''} — {c.expected}{' '}
                                <span className="num">{m.expected}</span>, {c.onChain} <span className="num">{m.onChain}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {data.failed.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl text-ink">{c.failedTitle}</h2>
          <Table head={[c.token, t.admin.common.email, t.app.dashboard.tokens, c.attempts, t.admin.common.reason, '']} minWidth="52rem">
            {data.failed.map((a) => (
              <tr key={a.allocationId} className="border-b border-line">
                <td className={`${td} num`}>{a.tokenSymbol}</td>
                <td className={`${td} break-all`}>{a.email}</td>
                <td className={tdNum}>{f.int(a.tokens)}</td>
                <td className={tdNum}>{a.attempts}</td>
                <td className={`${td} text-xs text-ink-3`}>{a.reason}</td>
                <td className={td}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={action.pending}
                    onClick={() => action.run(() => api(`/admin/chain/allocations/${a.allocationId}/retry`, { method: 'POST' }))}
                  >
                    {c.requeue}
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        </section>
      )}
    </div>
  );
}
