// =============================================================================
//  lib/offline/queue.ts
//  Outbox: a durable queue of mutations to replay against Supabase when online.
//
//  Each entry describes a logical operation (insert/update/delete on a table,
//  or an RPC call like processStockOut). When the SyncManager comes online it
//  drains the queue in createdAt order. If an entry fails with a non-retryable
//  error (validation, FK violation), it's moved to the dead-letter list so the
//  user can review and discard.
// =============================================================================

import { idb } from './db';
import type { StoreName } from './schema';

export type OutboxOp =
  | 'insert'
  | 'update'
  | 'delete'
  | 'rpc';

export interface OutboxEntry {
  /** UUID-ish — generated client-side. */
  id: string;
  op: OutboxOp;
  /** Target Supabase table (for insert/update/delete) or RPC name (for rpc). */
  target: string;
  /**
   * Payload sent to Supabase:
   *   • insert → row object
   *   • update → { match: { id: ... }, patch: {...} }
   *   • delete → { match: { id: ... } }
   *   • rpc    → arguments object
   */
  payload: unknown;
  /** Optional local id this mutation refers to (e.g. "local:abc"). */
  localId?: string;
  /** When the user triggered the mutation. */
  createdAt: string;
  /** How many replay attempts have failed so far. */
  attempts: number;
  /** Last error message from the server, if any. */
  lastError?: string;
  /** Marked true when the entry has failed permanently and needs review. */
  dead: boolean;
}

const STORE: StoreName = 'outbox';

function newId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const outbox = {
  async enqueue(
    entry: Omit<OutboxEntry, 'id' | 'createdAt' | 'attempts' | 'dead'>,
  ): Promise<OutboxEntry> {
    const e: OutboxEntry = {
      id: newId(),
      createdAt: new Date().toISOString(),
      attempts: 0,
      dead: false,
      ...entry,
    };
    await idb.put(STORE, e);
    return e;
  },

  async list(): Promise<OutboxEntry[]> {
    const all = await idb.getAll<OutboxEntry>(STORE);
    return [...all].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async pending(): Promise<OutboxEntry[]> {
    return (await this.list()).filter((e) => !e.dead);
  },

  async dead(): Promise<OutboxEntry[]> {
    return (await this.list()).filter((e) => e.dead);
  },

  async remove(id: string): Promise<void> {
    await idb.delete(STORE, id);
  },

  async markFailed(id: string, error: string, isPermanent = false): Promise<void> {
    const entry = await idb.get<OutboxEntry>(STORE, id);
    if (!entry) return;
    entry.attempts += 1;
    entry.lastError = error;
    entry.dead = isPermanent || entry.attempts >= 5;
    await idb.put(STORE, entry);
  },

  async clear(): Promise<void> {
    await idb.clear(STORE);
  },

  async count(): Promise<number> {
    return idb.count(STORE);
  },
};
