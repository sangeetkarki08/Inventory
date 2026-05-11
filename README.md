# ConstructionIMS — Online & Offline

Next.js 16 + Supabase Construction Inventory Management System with **first-class offline support**.

This is the "Inventory Management" branch of the project: it copies the online-only
codebase from `../` and adds a service worker, IndexedDB mirror, sync queue, and
offline-aware action wrappers so the app keeps working when the network drops.

**The data layer documentation that follows applies to the online path.** For the
offline architecture and how to extend it to new pages, see [OFFLINE.md](./OFFLINE.md).

---

## Online + offline at a glance

| Mode | What happens |
|------|--------------|
| Online (Supabase reachable) | Server Components fetch from Supabase. Mutations go through Server Actions. The local IndexedDB mirror is kept fresh in the background. |
| Offline (no network or Supabase down) | The service worker serves the cached app shell. Pages hydrate from IndexedDB. Form submissions are written locally and queued in an outbox. |
| Reconnecting | The sync manager fires on `window.online`, drains the outbox to Supabase, then pulls the latest snapshot of every table. |

A status pill in the bottom-right shows live online state and the queue size,
and turns into a "Sync now" button when there's pending work.

**Quick test:**

```bash
npm run build
npm run start
# sign in once, then DevTools → Network → Offline
# the app continues to load and accept changes; reconnect to sync
```

See [OFFLINE.md](./OFFLINE.md) for the full architecture.

---

# ConstructionIMS v3 — original docs

Server-side migration of the legacy IndexedDB Construction Inventory Management System to **Next.js 15 + Supabase**.

This zip contains the **foundation layer**: database schema, FIFO engine, TypeScript contracts, and Supabase client wiring. The dashboard, forms, and TanStack Query layer are listed under [What's next](#whats-next).

---

## What's in the box

```
cims-v3/
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql        ← Tables, enums, RLS policies, views
│       └── 0002_fifo_rpc.sql    ← process_stock_out() Postgres function
├── types/
│   └── database.types.ts        ← Strict TS types — no `any`, branded IDs
├── lib/
│   ├── services/
│   │   └── stock-out.service.ts ← FIFO service + zod validation + error mapping
│   └── supabase/
│       ├── server.ts            ← Server Component / Route Handler client
│       ├── client.ts            ← Client Component client
│       └── middleware.ts        ← Session refresh logic
├── middleware.ts                ← Next.js middleware entry
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.mjs
├── .env.local.example
└── .gitignore
```

---

## Setup

### 1. Install dependencies

```bash
cd cims-v3
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com) → New Project. Once it's provisioned, grab:

- **Project URL** (Settings → API)
- **anon public key** (Settings → API)

### 3. Configure environment

```bash
cp .env.local.example .env.local
# then edit .env.local with your Supabase URL + anon key
```

### 4. Run the migrations

**Option A — Supabase CLI (recommended):**

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

**Option B — Manual:**

Open Supabase Studio → SQL Editor → paste `supabase/migrations/0001_init.sql` → run.
Then paste `supabase/migrations/0002_fifo_rpc.sql` → run.

### 5. Create your first admin user

In Supabase Studio → Authentication → Users → "Add user". After signup, the trigger
in `0001_init.sql` auto-creates a `profiles` row with role `Store Manager`. Promote
yourself to Admin in the SQL Editor:

```sql
update public.profiles
set role = 'Admin'
where id = (select id from auth.users where email = 'you@example.com');
```

### 6. Run the dev server

```bash
npm run dev
```

> **Note:** This drop ships the data layer only — the `app/` directory hasn't been
> built yet, so `npm run dev` will 404 until you scaffold pages. See the next section.

---

## Using the FIFO engine

The `processStockOut()` service is the only sanctioned way to issue stock. It wraps
the Postgres RPC, validates input with zod, and normalizes errors.

```ts
import { createClient } from '@/lib/supabase/client';
import { processStockOut, InsufficientStockError } from '@/lib/services/stock-out.service';

const supabase = createClient();

try {
  const result = await processStockOut(supabase, {
    itemId: 42,
    quantity: 25,
    siteId: 3,
    issueType: 'Consumption',
    issuedAt: '2026-05-04',
    description: 'Pier foundation concrete',
  });

  console.log('Issued. Total cost:', result.total_cost);
  console.log('FIFO breakdown:', result.breakdown);
  // → [{ stock_in_id: 12, quantity: 20, unit_rate: 420 },
  //    { stock_in_id: 18, quantity: 5,  unit_rate: 425 }]
} catch (err) {
  if (err instanceof InsufficientStockError) {
    // show a friendly "not enough stock" toast
  } else {
    // unexpected error — log + generic message
  }
}
```

### Why a Postgres RPC instead of TS-side logic?

The legacy `app.js` had a subtle race in `processStockOut`: between reading batches
and writing back the consumed quantities, a second tab could deplete the same
batch. The RPC closes that race with `SELECT ... FOR UPDATE` row locks held inside
the cursor loop, and the whole sequence is one transaction — partial deductions
never persist.

---

## Schema highlights

| Table                | Purpose                                                  | Notes                                                                         |
|----------------------|----------------------------------------------------------|-------------------------------------------------------------------------------|
| `profiles`           | Extends `auth.users` with `role` + `full_name`           | Auto-created on signup via trigger                                            |
| `companies`          | Top-level org                                            | One company → many projects                                                   |
| `projects`           | Construction projects                                    | Status: Active / On Hold / Completed / Cancelled                              |
| `sites`              | Physical locations (Main Store, Site, Subcontractor…)    | Optional FK to `projects`                                                     |
| `equipment`          | Heavy machinery & tools                                  | Status: Active / Under Repair / Idle / Retired                                |
| `items`              | Item master                                              | `equipment_id` non-null **only** when `category = 'Spare Parts'` (CHECK)      |
| `stock_in`           | Receipt batches — FIFO source of truth                   | `base_amount`, `vat_amount`, `total_with_vat` are **generated columns**       |
| `stock_out`          | Issues / consumption                                     | `total_cost` written by the RPC only — never client-side                      |
| `stock_out_batches`  | Junction: which IN batches funded which OUT              | Replaces the legacy `batchBreakdown` JSON blob                                |
| `purchase_orders`    | PO header + lines                                        | `line_total` is a generated column                                            |
| `app_settings`       | Key-value store (e.g. `vat_rate`)                        | JSONB values                                                                  |
| `v_item_stock`       | View: current qty + FIFO value + stock_status per item   | Use this for the dashboard — never sum `stock_in` - `stock_out` manually      |

### RLS roles

- **Authenticated** — read everything.
- **Store Manager** — insert `stock_in`, `stock_out` (via RPC), `purchase_orders`.
- **Admin** — full CRUD on every table including master data and settings.

---

## What's next

The data layer is solid; the UI layer is next. In rough build order:

1. **App shell** — `app/layout.tsx`, sidebar nav, login page (`app/login/page.tsx`).
2. **TanStack Query providers** — `app/providers.tsx` with the QueryClient.
3. **Dashboard** (`app/(app)/dashboard/page.tsx`) — Server Component reading
   `v_item_stock`, KPI grid + Recharts donut & bar charts.
4. **Item Master** — list, create/edit modal with the Spare Parts → Equipment link.
5. **Stock IN form** — `react-hook-form` + zod, with the live VAT calculation
   (`Base + Base × VAT% = Total`) mirroring the generated columns.
6. **Stock OUT form** — calls `processStockOut()`; shows the FIFO breakdown after
   submit.
7. **Equipment / Sites / Projects** — standard CRUD pages.
8. **PO Generator + Purchase Orders** — port the auto-suggest logic from
   `app.js:renderPOGenerator`.
9. **Reports** — period filters, ledger view, FIFO valuation report.
10. **Seed script** — port the demo data from `app.js:2397–2438` into a
    `scripts/seed.ts` using the service-role key.

Let me know which to tackle next and I'll add it on top of this foundation.

---

## Stack

- **Next.js 15** (App Router, React Server Components)
- **TypeScript** (strict mode, branded IDs, no `any`)
- **Supabase** (Postgres + Auth + RLS)
- **Tailwind CSS** + **Lucide React**
- **TanStack Query** (server state)
- **react-hook-form** + **zod** (forms + validation)
- **Recharts** (dashboards)
#   I n v e n t o r y  
 