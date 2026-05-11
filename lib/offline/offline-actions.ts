// =============================================================================
//  lib/offline/offline-actions.ts
//  Thin wrappers around server actions that survive going offline.
//
//  Usage:
//    import { offlineFormAction } from '@/lib/offline/offline-actions';
//    import { createItem } from '@/lib/actions/items';
//
//    const result = await offlineFormAction(createItem, formData, {
//      table: 'items',
//      buildRow: (fd) => Object.fromEntries(fd.entries()),
//    });
//
//  If the network is up, the server action runs as usual and we mirror its
//  result to IndexedDB. If the network is down (fetch failure detected via the
//  online flag or a thrown TypeError), we fall back to repo.create / .update /
//  .delete which write to IDB and queue a replay.
// =============================================================================

'use client';

import { repo } from './repository';
import { syncManager } from './sync';
import type { StoreName } from './schema';

type WritableTable = Exclude<StoreName, 'meta' | 'outbox' | 'v_item_stock'>;

interface FormActionOpts<TInput, TRow> {
  /** Table to mirror the result into (e.g. 'items'). */
  table: WritableTable;
  /** Build the row to write into IDB from the form input. */
  buildRow: (input: TInput) => TRow;
}

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof TypeError) return true; // "Failed to fetch"
  const msg = (err as Error).message ?? '';
  return /network|fetch|offline|unreachable/i.test(msg);
}

/**
 * Run a server action; if offline, create the row locally and queue.
 */
export async function offlineCreate<TInput extends FormData | Record<string, unknown>, TRow extends Record<string, unknown>>(
  action: (input: TInput) => Promise<ActionResult<{ id?: number } | undefined>>,
  input: TInput,
  opts: FormActionOpts<TInput, TRow>,
): Promise<ActionResult<{ id: string | number; queued: boolean }>> {
  if (!syncManager.getState().isOnline) {
    try {
      const res = await repo.create(opts.table, opts.buildRow(input));
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  try {
    const res = await action(input);
    if (!res.ok) return res as ActionResult<{ id: string | number; queued: boolean }>;
    return {
      ok: true,
      data: { id: res.data?.id ?? -1, queued: false },
    };
  } catch (err) {
    if (isNetworkError(err)) {
      // Network blip mid-call — degrade to offline path.
      const res = await repo.create(opts.table, opts.buildRow(input));
      return { ok: true, data: res };
    }
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Wrap an update server action.
 */
export async function offlineUpdate<TInput extends FormData | Record<string, unknown>, TRow extends Record<string, unknown>>(
  action: (id: number, input: TInput) => Promise<ActionResult>,
  id: number,
  input: TInput,
  opts: FormActionOpts<TInput, TRow>,
): Promise<ActionResult<{ queued: boolean }>> {
  if (!syncManager.getState().isOnline) {
    try {
      const res = await repo.update(opts.table, id, opts.buildRow(input));
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  try {
    const res = await action(id, input);
    if (!res.ok) return res as ActionResult<{ queued: boolean }>;
    return { ok: true, data: { queued: false } };
  } catch (err) {
    if (isNetworkError(err)) {
      const res = await repo.update(opts.table, id, opts.buildRow(input));
      return { ok: true, data: res };
    }
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Wrap a delete server action.
 */
export async function offlineDelete(
  action: (id: number) => Promise<ActionResult>,
  id: number,
  opts: { table: WritableTable },
): Promise<ActionResult<{ queued: boolean }>> {
  if (!syncManager.getState().isOnline) {
    try {
      const res = await repo.delete(opts.table, id);
      return { ok: true, data: res };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  try {
    const res = await action(id);
    if (!res.ok) return res as ActionResult<{ queued: boolean }>;
    return { ok: true, data: { queued: false } };
  } catch (err) {
    if (isNetworkError(err)) {
      const res = await repo.delete(opts.table, id);
      return { ok: true, data: res };
    }
    return { ok: false, error: (err as Error).message };
  }
}
