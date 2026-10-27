'use client';

import { COOKIE_CSRF } from '@jpt/shared';

/**
 * Browser → API calls go through the same-origin proxy (/api/v1/...).
 * State-changing requests echo the CSRF cookie in X-CSRF-Token.
 */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

export interface ApiOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const method = opts.method ?? (opts.body === undefined ? 'GET' : 'POST');
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET') {
    const csrf = readCookie(COOKIE_CSRF);
    if (csrf) headers['x-csrf-token'] = csrf;
  }
  if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: 'same-origin',
      cache: 'no-store',
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiClientError(0, 'NETWORK', 'The service could not be reached');
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      typeof data?.code === 'string' ? data.code : 'ERROR',
      typeof data?.message === 'string' ? data.message : `Request failed (${res.status})`,
      data?.details,
    );
  }
  return data as T;
}

export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Dev helpers (email outbox, simulated provider results) are visible outside production only. */
export const DEV_TOOLS = process.env.NEXT_PUBLIC_DEV_TOOLS
  ? process.env.NEXT_PUBLIC_DEV_TOOLS === 'true'
  : process.env.NODE_ENV !== 'production';
