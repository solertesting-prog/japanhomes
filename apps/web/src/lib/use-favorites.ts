'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Favourites for signed-out visitors live in localStorage on this device.
 * Phase 3 syncs them to `favorite_properties` once the visitor signs in.
 */
const KEY = 'jpt:favorites';
const EVENT = 'jpt:favorites-change';
const EMPTY: readonly string[] = [];
let cache: { raw: string | null; list: readonly string[] } = { raw: null, list: EMPTY };

function read(): readonly string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === cache.raw) return cache.list;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string').slice(0, 200) : [];
    cache = { raw, list };
    return list;
  } catch {
    return EMPTY;
  }
}

function subscribe(onChange: () => void) {
  const handler = (e: Event) => {
    if (e instanceof StorageEvent && e.key !== KEY) return;
    onChange();
  };
  window.addEventListener('storage', handler);
  window.addEventListener(EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(EVENT, handler);
  };
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, read, () => EMPTY);
  const toggle = useCallback((slug: string) => {
    const current = read();
    const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage blocked (private mode): favourites simply do not persist */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { favorites, isFavorite: (slug: string) => favorites.includes(slug), toggle };
}
