# Offline Mode — Architecture & How To Extend

This app works both **online** (the original Supabase-backed flow) and **offline**
(local-first via IndexedDB, with automatic sync when the connection comes back).

This document explains how the offline layer is wired and how to extend the
pattern to additional pages.

---

## TL;DR

- **Service worker** (`public/sw.js`) caches the app shell so the UI loads with
  no network.
- **IndexedDB mirror** (`lib/offline/db.ts`) holds a local copy of every
  syncable table.
- **Sync manager** (`lib/offline/sync.ts`) pulls fresh data when online and
  replays the offline outbox.
- **Outbox** (`lib/offline/queue.ts`) durably queues mutations made while
  offline so nothing is lost.
- **Repository** (`lib/offline/repository.ts`) is the client-side API for
  reads/writes — it picks online vs. offline transparently.
- **Offline action wrappers** (`lib/offline/offline-actions.ts`) wrap the
  existing Server Actions so forms keep working when the server is unreachable.
- **`<NetworkStatus />`** shows live online/offline + queue state in the
  bottom-right.

---

## Pieces, in order

### 1. The service worker — `public/sw.js`

Registered from `app/_offline/service-worker-register.tsx` (mounted in
`app/layout.tsx`). It only runs in production builds — service workers + Next's
dev fast-refresh don't mix well.

Strategy:

| Request | Strategy |
|---------|----------|
| `/_next/static/*` (immutable, content-hashed) | Cache-first |
| Page navigations | Network-first → cache fallback → `/offline` |
| Static assets in `/public` | Cache-first |
| Supabase or `/api/*` | Pass-through (handled by IndexedDB layer separately) |

Bump `CACHE_VERSION` in `sw.js` whenever you change the shell — old caches are
auto-evicted on `activate`.

### 2. IndexedDB layer — `lib/offline/db.ts` + `schema.ts`

`schema.ts` declares one object store per Supabase table we mirror (`items`,
`companies`, `stock_in`, …) plus two infrastructure stores:

- `meta` — per-store sync timestamps.
- `outbox` — the queue of pending mutations.

`db.ts` is a tiny Promise-based wrapper over the browser's native IndexedDB
API — no extra dependency, no bundle bloat. Public methods:

```ts
idb.getAll<T>(store)
idb.get<T>(store, id)
idb.put(store, value)
idb.bulkPut(store, values)
idb.replaceAll(store, values)
idb.delete(store, id)
idb.clear(store)
idb.wipe()           // drop the database entirely (use on sign-out)
```

### 3. Outbox — `lib/offline/queue.ts`

A durable list of mutations to replay against Supabase. Each entry has:

```ts
{ op: 'insert' | 'update' | 'delete' | 'rpc',
  target: string,         // table name or RPC name
  payload: unknown,       // shape depends on op
  localId?: string,       // 'local:abc' if this row was created offline
  attempts: number,
  dead: boolean }         // true once the entry has failed 5+ times
                          // or hit a permanent error (constraint / RLS)
```

### 4. Sync manager — `lib/offline/sync.ts`

Singleton. Started by `<OfflineProvider />` (mounted inside `app/providers.tsx`).

On boot and whenever `window` fires `online`:

1. **Push**: drain the outbox, calling Supabase for each entry. On success the
   entry is removed; on failure it's incremented or marked dead.
2. **Pull**: for every syncable store, read every row from Supabase and replace
   the local mirror.

State is exposed via `useSyncState()`:

```ts
{ isOnline, phase, lastSyncedAt, pendingCount, deadCount, lastError }
```

### 5. Repository — `lib/offline/repository.ts`

Single API client code uses for reads + writes:

```ts
import { repo } from '@/lib/offline';

// Reads (always from IDB)
const items = await repo.list<ItemRow>('items');
const item  = await repo.get<ItemRow>('items', 42);

// Writes (online → Supabase + mirror; offline → IDB + outbox)
const { id, queued } = await repo.create('items', newRow);
await repo.update('items', 42, { name: 'New name' });
await repo.delete('items', 42);
```

### 6. Offline-aware action wrappers — `lib/offline/offline-actions.ts`

Most forms in the original app submit FormData to a `'use server'` Server
Action. Server Actions need the Next.js server reachable — which it usually is
locally, **but** the Supabase call inside them will fail if the database is
unreachable. The wrappers handle both:

```ts
import { offlineCreate, offlineUpdate, offlineDelete } from '@/lib/offline';
import { createItem, updateItem, deleteItem } from '@/lib/actions/items';

// Create
const res = await offlineCreate(createItem, formData, {
  table: 'items',
  buildRow: (fd) => ({ name: String(fd.get('name')), /* … */ }),
});

// Update
await offlineUpdate(updateItem, id, formData, { table: 'items', buildRow });

// Delete
await offlineDelete(deleteItem, id, { table: 'items' });
```

If we're online, the original Server Action runs unchanged. If we're offline
(or the action throws a network error mid-call), the mutation falls back to the
repo, which writes locally and queues for sync.

### 7. React hooks — `lib/offline/hooks.ts`

```ts
const sync   = useSyncState();                         // online state + queue
const { rows, loading, refresh } = useOfflineTable<ItemRow>('items', seed);
const pending = usePendingCount();
```

`useOfflineTable` is a drop-in replacement for "read this table from a Server
Component" when you need the data live on the client. Pass the server-rendered
rows as `seed` to avoid a loading flash.

---

## How to make page X work offline

Take the items page as the reference (already done):

### A) The Server Component page — make it tolerant of network failures

`app/(app)/items/page.tsx` wraps its Supabase calls in a `try/catch` and falls
through with an empty seed if Supabase is unreachable. The client-side view
then hydrates from IndexedDB.

```tsx
let items: ItemRow[] = [];
try {
  const supabase = await createClient();
  const res = await supabase.from('items').select('*');
  if (!res.error) items = res.data as ItemRow[];
} catch {
  // Client will hydrate from IndexedDB.
}
return <ItemsView items={items} />;
```

### B) The Client Component view — fall back to IDB when offline

```tsx
import { useOfflineTable, useSyncState } from '@/lib/offline';

const sync = useSyncState();
const { rows: offlineRows } = useOfflineTable<ItemRow>('items', items);
const live = sync.isOnline ? items : offlineRows;
```

### C) The form — call the offline wrapper instead of the raw action

```tsx
import { offlineCreate } from '@/lib/offline';
import { createItem } from '@/lib/actions/items';

await offlineCreate(createItem, formData, {
  table: 'items',
  buildRow: (fd) => Object.fromEntries(fd.entries()),
});
```

That's it. Repeat for every entity you want to make offline-capable.

---

## Caveats and known limits

- **The FIFO RPC (`processStockOut`) cannot run offline.** It needs server-side
  row-level locking to compute correct batches. If you record a stock-out while
  offline, the outbox queues it as an `'rpc'` entry and runs it on reconnect.
  The user won't see the FIFO breakdown until that happens. Make this clear in
  the stock-out form UI.
- **Local-id collisions.** Rows created offline get a string id like
  `local:abc123`. Once synced, Supabase assigns a real numeric id; the next
  pull replaces the local row. Don't store the local id in foreign keys
  elsewhere — wait for sync first.
- **Conflict policy is last-writer-wins.** This app is per-user so that's fine
  for now. For multi-user editing you'd need version vectors or CRDTs.
- **Service worker only runs in `npm run build && npm run start`** — not in
  `npm run dev`. The registration code unregisters any leftover SW in dev mode
  to keep things sane.

---

## Testing offline mode

1. `npm run build && npm run start`
2. Sign in once with the network up so the IDB mirror populates.
3. In DevTools → Network tab, set throttle to **Offline**.
4. Reload — the shell still loads, lists still render, forms accept new items.
5. Re-enable the network. The sync pill in the bottom-right shows
   "Syncing changes…" then disappears.
6. Check the Supabase Studio table — your offline changes are now there.

---

## Wiping local data

On sign-out, call:

```ts
import { idb } from '@/lib/offline';
await idb.wipe();
```

This drops the IndexedDB database and any queued mutations. Pair it with a
`navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHES' })` to
also evict the shell cache (useful in dev / debugging).
