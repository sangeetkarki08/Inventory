// =============================================================================
//  lib/offline/schema.ts
//  Schema for the local IndexedDB mirror of the Supabase database.
//
//  Each store mirrors a Postgres table (or view). The keyPath is the primary
//  key — for tables we sync from Supabase that's the integer `id`. For records
//  created offline (which don't have a server id yet) we use a `_localId` prefix
//  like `local:abc123` until the server assigns a real id.
//
//  Indexes are kept minimal — most filtering happens in-memory once the table
//  is loaded. Add an index only when a hot query needs it.
// =============================================================================

export const DB_NAME = 'cims-offline';
export const DB_VERSION = 1;

export interface StoreSpec {
  name: string;
  keyPath: string;
  /** Optional indexes — `[name, keyPath, unique?]`. */
  indexes?: ReadonlyArray<readonly [string, string, boolean?]>;
}

export const STORES: ReadonlyArray<StoreSpec> = [
  // Master / reference data
  { name: 'profiles',            keyPath: 'id' },
  { name: 'companies',           keyPath: 'id' },
  { name: 'projects',            keyPath: 'id', indexes: [['by_company', 'company_id']] },
  { name: 'sites',               keyPath: 'id', indexes: [['by_project', 'project_id']] },
  { name: 'equipment',           keyPath: 'id' },
  { name: 'items',               keyPath: 'id', indexes: [['by_category', 'category']] },

  // Transactional
  { name: 'stock_in',            keyPath: 'id', indexes: [['by_item', 'item_id']] },
  { name: 'stock_out',           keyPath: 'id', indexes: [['by_item', 'item_id']] },
  { name: 'stock_out_batches',   keyPath: 'id', indexes: [['by_stock_out', 'stock_out_id']] },
  { name: 'purchase_orders',     keyPath: 'id' },
  { name: 'purchase_order_lines',keyPath: 'id', indexes: [['by_po', 'po_id']] },

  // Views (read-only mirror — refreshed on every sync pull)
  { name: 'v_item_stock',        keyPath: 'item_id' },

  // Settings
  { name: 'app_settings',        keyPath: 'key' },

  // Offline metadata
  // 'meta' holds sync timestamps per store: { key, lastSyncedAt }
  { name: 'meta',                keyPath: 'key' },
  // 'outbox' holds queued mutations waiting to be replayed
  { name: 'outbox',              keyPath: 'id', indexes: [['by_created', 'createdAt']] },
] as const;

export type StoreName = (typeof STORES)[number]['name'];

/** Stores that are pulled from Supabase on sync — excludes meta/outbox. */
export const SYNCED_STORES: ReadonlyArray<StoreName> = STORES
  .map((s) => s.name)
  .filter((n) => n !== 'meta' && n !== 'outbox') as StoreName[];

/** Stores that the user can write to offline. */
export const WRITABLE_STORES: ReadonlyArray<StoreName> = [
  'companies',
  'projects',
  'sites',
  'equipment',
  'items',
  'stock_in',
  'stock_out',
  'purchase_orders',
  'purchase_order_lines',
  'app_settings',
];
