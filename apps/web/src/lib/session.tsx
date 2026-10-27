'use client';

import type { MeDto } from '@jpt/shared';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiClientError } from './client-api';

interface SessionValue {
  me: MeDto | null;
  /** true until the first /auth/me answer arrives */
  loading: boolean;
  refresh: () => Promise<MeDto | null>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<MeDto>('/auth/me');
      setMe(data);
      return data;
    } catch (e) {
      if (!(e instanceof ApiClientError) || e.status === 401 || e.status === 403 || e.status === 0) setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setMe(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <SessionContext.Provider value={{ me, loading, refresh, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession must be used inside <SessionProvider>');
  return v;
}

/**
 * Client-side gate for signed-in pages. The API enforces access regardless;
 * this only decides where to send the visitor.
 */
export function useRequireSession(opts: { verified?: boolean } = {}) {
  const { me, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (loading) return;
    const next = encodeURIComponent(pathname);
    if (!me) router.replace(`/sign-in?next=${next}`);
    else if (me.mfaPending) router.replace(`/sign-in?step=mfa&next=${next}`);
    else if (opts.verified && !me.roles.includes('VERIFIED_INVESTOR')) router.replace(`/verify?next=${next}`);
  }, [me, loading, router, pathname, opts.verified]);
  const ready = !loading && !!me && !me.mfaPending && (!opts.verified || me.roles.includes('VERIFIED_INVESTOR'));
  return { me, ready };
}
