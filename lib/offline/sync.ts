// =============================================================================
//  lib/offline/sync.ts
//  SyncManager — singleton that bridges the IndexedDB cache and Supabase.
//
//  Responsibilities:
//   1. Track online/offline state (navigator.onLine + window events).
//   2. On boot (and on reconnect) pull all syncable tables into IndexedDB
//      so the UI has fresh data to display when offline.
//   3. Drain the outbox: replay each queued mutation against Supabase, then
//      remove or mark-dead on failure.
//   4. Emit state changes so React components can react via useSyncState().
//
//  Conflict policy: last-writer-wins, scoped to single-user usage. The original
//  app is per-user; if multi-user editing is added later, a more sophisticated
//  merge layer will be needed (CRDT/version vectors).
// =============================================================================

'use client';

import { createClient } from '@/lib/supabase/client';
import { idb } from './db';
import { outbox, type OutboxEntry } from './queue';
import { SYNCED_STORES, type StoreName } from './schema';

export type SyncPhase = 'idle' | 'pulling' | 'pushing' | 'error';

export interface SyncState {
  isOnline: boolean;
  phase: SyncPhase;
  lastSyncedAt: string | null;
  pendingCount: number;
  deadCount: number;
  lastError: string | null;
}

type Listener = (state: SyncState) => void;

class SyncManager {
  private state: SyncState = {
    isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
    phase: 'idle',
    lastSyncedAt: null,
    pendingCount: 0,
    deadCount: 0,
    lastError: null,
  };
  private listeners = new Set<Listener>();
  private started = false;
  private syncInFlight: Promise<void> | null = null;

  getState(): SyncState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }

  async start(): Promise<void> {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);

    await this.refreshCounts();

    // Best effort: pull on boot if online.
    if (this.state.isOnline) {
      this.runSync().catch(() => {});
    }
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOffline);
    }
  }

  private onOnline = (): void => {
    this.set({ isOnline: true });
    this.runSync().catch(() => {});
  };
  private onOffline = (): void => {
    this.set({ isOnline: false, phase: 'idle' });
  };

  /** Manual trigger — useful for a "sync now" button. */
  async runSync(): Promise<void> {
    if (!this.state.isOnline) return;
    if (this.syncInFlight) return this.syncInFlight;
    this.syncInFlight = this.doSync().finally(() => {
      this.syncInFlight = null;
    });
    return this.syncInFlight;
  }

  private async doSync(): Promise<void> {
    try {
      this.set({ phase: 'pushing', lastError: null });
      await this.drainOutbox();

      this.set({ phase: 'pulling' });
      await this.pullAll();

      this.set({
        phase: 'idle',
        lastSyncedAt: new Date().toISOString(),
        lastError: null,
      });
      await this.refreshCounts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.set({ phase: 'error', lastError: msg });
      await this.refreshCounts();
    }
  }

  // ─── Pull ────────────────────────────────────────────────────────────────
  /**
   * Pull every syncable table from Supabase and replace the local mirror.
   * Tables the user is not authorized to read return [] (RLS filters), which
   * is fine — the empty mirror just means "no offline data for this entity".
   */
  private async pullAll(): Promise<void> {
    if (!idb.isAvailable()) return;
    const supabase = createClient();

    const tableNames: StoreName[] = SYNCED_STORES.filter(
      (s) => s !== 'profiles', // profiles is fetched at auth time
    );

    for (const table of tableNames) {
      try {
        const { data, error } = await supabase
          .from(table as string)
          .select('*');
        if (error) {
          // RLS denial or table missing — skip.
          continue;
        }
        await idb.replaceAll(table, (data ?? []) as readonly unknown[]);
        await idb.put('meta', { key: `sync:${table}`, lastSyncedAt: new Date().toISOString() });
      } catch {
        // Best effort: keep pulling other tables.
      }
    }
  }

  // ─── Push ────────────────────────────────────────────────────────────────
  private async drainOutbox(): Promise<void> {
    const pending = await outbox.pending();
    if (pending.length === 0) return;
    const supabase = createClient();

    for (const entry of pending) {
      try {
        await this.replay(entry, supabase);
        await outbox.remove(entry.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const permanent = isPermanentError(msg);
        await outbox.markFailed(entry.id, msg, permanent);
      }
    }
  }

  private async replay(
    entry: OutboxEntry,
    supabase: ReturnType<typeof createClient>,
  ): Promise<void> {
    // postgrest-js 2.105 has aggressive generic narrowing that resolves these
    // signatures to `never` when the table name is a string. We cast the
    // builder steps through `unknown` — same workaround used in lib/actions.
    type LooseQuery = { eq(c: string, v: unknown): LooseQuery };
    switch (entry.op) {
      case 'insert': {
        const { error } = await (
          supabase.from(entry.target) as unknown as {
            insert(v: unknown): Promise<{ error: { message: string } | null }>;
          }
        ).insert(entry.payload);
        if (error) throw new Error(error.message);
        return;
      }
      case 'update': {
        const p = entry.payload as { match: Record<string, unknown>; patch: Record<string, unknown> };
        let q = (supabase.from(entry.target) as unknown as {
          update(v: unknown): LooseQuery;
        }).update(p.patch);
        for (const [k, v] of Object.entries(p.match)) {
          q = q.eq(k, v);
        }
        const { error } = await (q as unknown as Promise<{ error: { message: string } | null }>);
        if (error) throw new Error(error.message);
        return;
      }
      case 'delete': {
        const p = entry.payload as { match: Record<string, unknown> };
        let q = (supabase.from(entry.target) as unknown as {
          delete(): LooseQuery;
        }).delete();
        for (const [k, v] of Object.entries(p.match)) {
          q = q.eq(k, v);
        }
        const { error } = await (q as unknown as Promise<{ error: { message: string } | null }>);
        if (error) throw new Error(error.message);
        return;
      }
      case 'rpc': {
        const { error } = await (supabase.rpc as unknown as (
          name: string,
          args: unknown,
        ) => Promise<{ error: { message: string } | null }>)(
          entry.target,
          entry.payload,
        );
        if (error) throw new Error(error.message);
        return;
      }
    }
  }

  private async refreshCounts(): Promise<void> {
    if (!idb.isAvailable()) return;
    try {
      const all = await outbox.list();
      this.set({
        pendingCount: all.filter((e) => !e.dead).length,
        deadCount: all.filter((e) => e.dead).length,
      });
    } catch {
      // ignore
    }
  }
}

function isPermanentError(message: string): boolean {
  // Validation, constraint violation, or auth — won't fix itself on retry.
  return /violat|constraint|invalid|not authorised|not authorized|forbidden|permission/i.test(
    message,
  );
}

export const syncManager = new SyncManager();
