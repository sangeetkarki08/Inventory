// =============================================================================
//  lib/offline/hooks.ts
//  React hooks for client components to consume the offline layer.
// =============================================================================

'use client';

import { useCallback, useEffect, useState } from 'react';
import { syncManager, type SyncState } from './sync';
import { repo } from './repository';
import type { StoreName } from './schema';

/**
 * Subscribe to the SyncManager state — online/offline, sync phase, queue size.
 */
export function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>(() => syncManager.getState());
  useEffect(() => syncManager.subscribe(setState), []);
  return state;
}

/**
 * Read a full table from IndexedDB. The result refreshes whenever the
 * SyncManager finishes a pull — so the data stays close to fresh while online,
 * and is the last-known-good snapshot when offline.
 *
 * Optional `seed`: pass server-rendered rows from a parent Server Component to
 * avoid the empty-flash on first paint. The hook hydrates with the seed and
 * then re-reads from IDB once mounted.
 */
export function useOfflineTable<T = unknown>(
  table: StoreName,
  seed: readonly T[] = [],
): { rows: T[]; loading: boolean; refresh: () => Promise<void> } {
  const [rows, setRows] = useState<T[]>(() => [...seed]);
  const [loading, setLoading] = useState(seed.length === 0);

  const load = useCallback(async () => {
    try {
      const data = await repo.list<T>(table);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [table]);

  useEffect(() => {
    void load();
    // Re-read whenever the sync phase returns to idle (i.e. a pull finished).
    let prev = syncManager.getState().phase;
    const unsub = syncManager.subscribe((s) => {
      if (prev !== 'idle' && s.phase === 'idle') void load();
      prev = s.phase;
    });
    return unsub;
  }, [load]);

  return { rows, loading, refresh: load };
}

/** Convenience hook for the queue count badge. */
export function usePendingCount(): number {
  return useSyncState().pendingCount;
}
