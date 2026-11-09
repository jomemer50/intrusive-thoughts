"use client";

import { useCallback, useEffect, useState } from 'react';

// Identity used to be a user id in localStorage, read and written straight
// against Supabase from the browser. It now lives in an httpOnly cookie set by
// /api/session; the browser only ever learns the display name.
const LEGACY_STORAGE_KEY = 'rungtatron_user_id';

export function useAnonymousUser() {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/session', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.displayName) {
        throw new Error(body.error || `Session request failed (${res.status})`);
      }
      setDisplayName(body.displayName);
      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {}
    } catch (err) {
      console.error('Anonymous session error:', err);
      setError(err instanceof Error ? err.message : 'Could not start a session');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot fetch on mount
    start();
  }, [start]);

  return { displayName, isLoading, error, retry: start, isReady: displayName !== null };
}
