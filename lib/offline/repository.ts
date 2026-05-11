// =============================================================================
//  lib/offline/repository.ts
//  The repository is the single place client components go to read and write
//  entity data. It hides the online/offline choice:
//
//    • read*  → returns IndexedDB rows. Fast, works offline. Freshness is
//      driven by the SyncManager (which pulls on connect & on demand).
//    • create / update / delete → if online, calls Supabase directly and
//      mirrors the result to IndexedDB. If offline, writes a local-only row
//      and enqueues the mutation in the outbox.
//
//  Server Components remain the authoritative path while the network is up —
//  they hit Supabase directly via @supabase/ssr. The repository is for the
//  CLIENT-side path that takes over when there's no server reachable.
// =============================================================================

'use client';

import { createClient } from '@/lib/supabase/client';
import { idb } from './db';
import { outbox } from './queue';
import { syncManager } from './sync';
import type { StoreName } from './schema';

const LOCAL_PREFIX = 'local:';
function newLocalId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  const tail = c?.randomUUID
    ? c.randomUUID()
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `${LOCAL_PREFIX}${tail}`;
}

export function isLocalId(id: unknown): id is string {
  return typeof id === 'string' && id.startsWith(LOCAL_PREFIX);
}

function isOnline(): boolean {
  return syncManager.getState().isOnline;
}

// ─── Reads ──────────────────────────────────────────────────────────────────
export const repo = {
  /** Returns rows from the local mirror — order matches insertion. */
  async list<T = unknown>(table: StoreName): Promise<T[]> {
    return idb.getAll<T>(table);
  },

  async get<T = unknown>(table: StoreName, id: IDBValidKey): Promise<T | undefined> {
    return idb.get<T>(table, id);
  },

  async getByIndex<T = unknown>(
    table: StoreName,
    index: string,
    value: IDBValidKey,
  ): Promise<T[]> {
    return idb.getByIndex<T>(table, index, value);
  },

  // ─── Writes ──────────────────────────────────────────────────────────────
  /**
   * Insert a row. Online → writes to Supabase first, then mirrors into IDB
   * with the server-assigned id. Offline → assigns a local id and queues.
   */
  async create<T extends Record<string, unknown>>(
    table: Exclude<StoreName, 'meta' | 'outbox' | 'v_item_stock'>,
    row: T,
  ): Promise<{ id: string | number; queued: boolean }> {
    if (isOnline()) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from(table)
        .insert(row as never)
        .select()
        .single();
      if (error) throw new Error(error.message);
      const saved = data as Record<string, unknown>;
      await idb.put(table, saved);
      return { id: saved.id as string | number, queued: false };
    }

    // Offline path
    const localId = newLocalId();
    const localRow = { ...row, id: localId, _localOnly: true };
    await idb.put(table, localRow);
    await outbox.enqueue({
      op: 'insert',
      target: table,
      payload: row,
      localId,
    });
    return { id: localId, queued: true };
  },

  /**
   * Patch a row. Optimistic — IDB is updated immediately whether or not we're
   * online; the outbox queues the server-side patch when offline.
   */
  async update<T extends Record<string, unknown>>(
    table: Exclude<StoreName, 'meta' | 'outbox' | 'v_item_stock'>,
    id: string | number,
    patch: Partial<T>,
  ): Promise<{ queued: boolean }> {
    // Apply patch locally so the UI updates immediately.
    const existing = (await idb.get<Record<string, unknown>>(table, id)) ?? null;
    const next = { ...(existing ?? { id }), ...patch, id };
    await idb.put(table, next);

    if (isOnline() && !isLocalId(id)) {
      const supabase = createClient();
      const { error } = await supabase
        .from(table)
        .update(patch as never)
        .eq('id', id as never);
      if (error) throw new Error(error.message);
      return { queued: false };
    }

    await outbox.enqueue({
      op: 'update',
      target: table,
      payload: { match: { id }, patch },
    });
    return { queued: true };
  },

  async delete(
    table: Exclude<StoreName, 'meta' | 'outbox' | 'v_item_stock'>,
    id: string | number,
  ): Promise<{ queued: boolean }> {
    await idb.delete(table, id);

    if (isOnline() && !isLocalId(id)) {
      const supabase = createClient();
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id as never);
      if (error) throw new Error(error.message);
      return { queued: false };
    }

    await outbox.enqueue({
      op: 'delete',
      target: table,
      payload: { match: { id } },
    });
    return { queued: true };
  },

  /**
   * Trigger a sync immediately. Returns when push + pull finish (or fails fast
   * if offline).
   */
  async syncNow(): Promise<void> {
    await syncManager.runSync();
  },
};
