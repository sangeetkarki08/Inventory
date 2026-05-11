-- ============================================================================
-- ConstructionIMS v3 — Supabase schema
-- Postgres 15+. Run inside a fresh Supabase project (the auth schema must exist).
-- ============================================================================

-- ─── Extensions ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ─── Enums (mirror legacy const arrays in app.js) ───────────────────────────
create type user_role           as enum ('Admin', 'Store Manager');
create type item_category       as enum ('Consumable', 'Tools', 'Equipment', 'Spare Parts');
create type item_unit           as enum ('Nos','Pcs','Kg','Ltr','Mtr','Box','Set','Roll','Bag','Ton','Pair','Sheet','Cu.m','Sq.m');
create type issue_type          as enum ('Consumption', 'Transfer', 'Tool Issue', 'Return');
create type site_type           as enum ('Main Store', 'Site', 'Subcontractor', 'Individual');
create type equipment_category  as enum ('Excavator','Crane','Bulldozer','Concrete Mixer','Vibrator','Generator','Compressor','Water Pump','Scaffold','Bar Cutter','Welding Machine','Other');
create type equipment_status    as enum ('Active', 'Under Repair', 'Idle', 'Retired');
create type project_status      as enum ('Active', 'On Hold', 'Completed', 'Cancelled');
create type po_status           as enum ('Draft', 'Sent', 'Partially Received', 'Received', 'Cancelled');

-- ─── updated_at trigger helper ──────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─── Profiles (extends auth.users) ──────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text         not null,
  role        user_role    not null default 'Store Manager',
  is_active   boolean      not null default true,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Helper to read the caller's role without recursing through RLS.
create or replace function public.current_role()
returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;
revoke all on function public.current_role() from public;
grant execute on function public.current_role() to authenticated;

-- Auto-create profile on signup. Default role = Store Manager.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'Store Manager')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Companies ──────────────────────────────────────────────────────────────
create table public.companies (
  id            bigserial primary key,
  name          text         not null,
  address       text,
  contact_email citext,
  contact_phone text,
  notes         text,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),
  created_by    uuid references public.profiles(id),
  unique (name)
);
create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

-- ─── Projects ───────────────────────────────────────────────────────────────
create table public.projects (
  id          bigserial primary key,
  company_id  bigint        not null references public.companies(id) on delete restrict,
  name        text          not null,
  status      project_status not null default 'Active',
  start_date  date,
  end_date    date,
  description text,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now(),
  created_by  uuid references public.profiles(id),
  check (end_date is null or start_date is null or end_date >= start_date),
  unique (company_id, name)
);
create index projects_company_idx on public.projects (company_id);
create index projects_status_idx  on public.projects (status);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ─── Sites ──────────────────────────────────────────────────────────────────
create table public.sites (
  id          bigserial primary key,
  name        text         not null,
  type        site_type    not null,
  description text,
  project_id  bigint references public.projects(id) on delete set null,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  created_by  uuid references public.profiles(id),
  unique (name, project_id)
);
create index sites_type_idx    on public.sites (type);
create index sites_project_idx on public.sites (project_id);
create trigger sites_updated_at before update on public.sites
  for each row execute function public.set_updated_at();

-- ─── Equipment ──────────────────────────────────────────────────────────────
create table public.equipment (
  id          bigserial primary key,
  name        text                not null,
  category    equipment_category  not null,
  model       text,
  serial_no   text                unique,
  site_id     bigint references public.sites(id) on delete set null,
  status      equipment_status    not null default 'Active',
  notes       text,
  created_at  timestamptz         not null default now(),
  updated_at  timestamptz         not null default now(),
  created_by  uuid references public.profiles(id)
);
create index equipment_site_idx     on public.equipment (site_id);
create index equipment_status_idx   on public.equipment (status);
create index equipment_category_idx on public.equipment (category);
create trigger equipment_updated_at before update on public.equipment
  for each row execute function public.set_updated_at();

-- ─── Items (master) ─────────────────────────────────────────────────────────
create table public.items (
  id                 bigserial primary key,
  name               text           not null,
  category           item_category  not null,
  unit               item_unit      not null,
  reorder_level      numeric(14,3)  not null default 0 check (reorder_level >= 0),
  max_level          numeric(14,3)  not null default 0 check (max_level >= 0),
  preferred_supplier text,
  -- Spare-parts-only link to a specific machine.
  equipment_id       bigint references public.equipment(id) on delete set null,
  description        text,
  is_active          boolean        not null default true,
  created_at         timestamptz    not null default now(),
  updated_at         timestamptz    not null default now(),
  created_by         uuid references public.profiles(id),
  constraint items_max_ge_reorder         check (max_level >= reorder_level),
  constraint items_equipment_only_for_sp  check (equipment_id is null or category = 'Spare Parts'),
  constraint items_name_unique            unique (name)
);
create index items_category_idx  on public.items (category);
create index items_equipment_idx on public.items (equipment_id) where equipment_id is not null;
create trigger items_updated_at before update on public.items
  for each row execute function public.set_updated_at();

-- ─── Stock IN (FIFO source-of-truth) ────────────────────────────────────────
create table public.stock_in (
  id                  bigserial primary key,
  item_id             bigint        not null references public.items(id) on delete restrict,
  received_at         date          not null default current_date,
  quantity            numeric(14,3) not null check (quantity > 0),
  unit_rate           numeric(14,4) not null check (unit_rate >= 0),
  vat_rate            numeric(5,2)  not null default 0 check (vat_rate >= 0 and vat_rate <= 100),
  -- Generated money columns — guaranteed consistent.
  base_amount         numeric(16,2) generated always as (round(quantity * unit_rate, 2)) stored,
  vat_amount          numeric(16,2) generated always as (round(quantity * unit_rate * vat_rate / 100, 2)) stored,
  total_with_vat      numeric(16,2) generated always as (round(quantity * unit_rate * (1 + vat_rate / 100), 2)) stored,
  -- FIFO depletion tracker. Updated only by the process_stock_out RPC.
  remaining_quantity  numeric(14,3) not null,
  supplier            text,
  description         text,
  project_id          bigint references public.projects(id) on delete set null,
  received_by         uuid references public.profiles(id),
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now(),
  constraint stock_in_remaining_le_qty check (remaining_quantity >= 0 and remaining_quantity <= quantity)
);
-- Composite index optimized for the FIFO scan: same item, oldest first, only batches with stock left.
create index stock_in_fifo_idx on public.stock_in (item_id, received_at, id)
  where remaining_quantity > 0;
create index stock_in_item_idx    on public.stock_in (item_id);
create index stock_in_project_idx on public.stock_in (project_id);
create index stock_in_date_idx    on public.stock_in (received_at);
create trigger stock_in_updated_at before update on public.stock_in
  for each row execute function public.set_updated_at();

-- Default remaining_quantity to quantity on insert.
create or replace function public.stock_in_default_remaining()
returns trigger language plpgsql as $$
begin
  if new.remaining_quantity is null then
    new.remaining_quantity := new.quantity;
  end if;
  return new;
end $$;

create trigger stock_in_set_remaining
  before insert on public.stock_in
  for each row execute function public.stock_in_default_remaining();

-- ─── Stock OUT ──────────────────────────────────────────────────────────────
create table public.stock_out (
  id           bigserial primary key,
  item_id      bigint        not null references public.items(id) on delete restrict,
  issued_at    date          not null default current_date,
  quantity     numeric(14,3) not null check (quantity > 0),
  site_id      bigint        not null references public.sites(id) on delete restrict,
  issue_type   issue_type    not null,
  description  text,
  -- Total cost is computed by the FIFO RPC; never written client-side.
  total_cost   numeric(16,2) not null default 0 check (total_cost >= 0),
  issued_by    uuid references public.profiles(id),
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now()
);
create index stock_out_item_idx on public.stock_out (item_id);
create index stock_out_site_idx on public.stock_out (site_id);
create index stock_out_date_idx on public.stock_out (issued_at);
create index stock_out_type_idx on public.stock_out (issue_type);
create trigger stock_out_updated_at before update on public.stock_out
  for each row execute function public.set_updated_at();

-- ─── Stock OUT batch breakdown (FIFO traceability) ──────────────────────────
create table public.stock_out_batches (
  id                          bigserial primary key,
  stock_out_id                bigint        not null references public.stock_out(id) on delete cascade,
  stock_in_id                 bigint        not null references public.stock_in(id)  on delete restrict,
  quantity_consumed           numeric(14,3) not null check (quantity_consumed > 0),
  unit_rate_at_consumption    numeric(14,4) not null check (unit_rate_at_consumption >= 0),
  created_at                  timestamptz   not null default now()
);
create index sob_stock_out_idx on public.stock_out_batches (stock_out_id);
create index sob_stock_in_idx  on public.stock_out_batches (stock_in_id);

-- ─── Purchase Orders ────────────────────────────────────────────────────────
create table public.purchase_orders (
  id           bigserial primary key,
  po_number    text          not null unique,
  supplier     text          not null,
  status       po_status     not null default 'Draft',
  ordered_at   date          not null default current_date,
  expected_at  date,
  notes        text,
  total_amount numeric(16,2) not null default 0,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now()
);
create index po_status_idx on public.purchase_orders (status);
create index po_date_idx   on public.purchase_orders (ordered_at);
create trigger po_updated_at before update on public.purchase_orders
  for each row execute function public.set_updated_at();

create table public.purchase_order_lines (
  id                 bigserial primary key,
  purchase_order_id  bigint        not null references public.purchase_orders(id) on delete cascade,
  item_id            bigint        not null references public.items(id) on delete restrict,
  quantity           numeric(14,3) not null check (quantity > 0),
  unit_rate          numeric(14,4) not null check (unit_rate >= 0),
  line_total         numeric(16,2) generated always as (round(quantity * unit_rate, 2)) stored
);
create index pol_po_idx on public.purchase_order_lines (purchase_order_id);

-- ─── App settings (key/value) ───────────────────────────────────────────────
create table public.app_settings (
  key        text         primary key,
  value      jsonb        not null,
  updated_at timestamptz  not null default now(),
  updated_by uuid references public.profiles(id)
);
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (key, value)
values ('vat_rate', to_jsonb(13.0))
on conflict (key) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
--  Strategy:
--    • Everyone authenticated can SELECT (read-only dashboard for both roles)
--    • Admin can do everything (insert/update/delete on every table)
--    • Store Manager can: create stock_in & stock_out (via RPC), create POs,
--      and update their own profile. Cannot delete master data or edit settings.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profiles             enable row level security;
alter table public.companies            enable row level security;
alter table public.projects             enable row level security;
alter table public.sites                enable row level security;
alter table public.equipment            enable row level security;
alter table public.items                enable row level security;
alter table public.stock_in             enable row level security;
alter table public.stock_out            enable row level security;
alter table public.stock_out_batches    enable row level security;
alter table public.purchase_orders      enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.app_settings         enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────
create policy "profiles: self read"       on public.profiles for select using (id = auth.uid() or public.current_role() = 'Admin');
create policy "profiles: self update"     on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy "profiles: admin full"      on public.profiles for all    using (public.current_role() = 'Admin') with check (public.current_role() = 'Admin');

-- ── helper macro: read-all for both roles, write for Admin only ────────────
-- (inlined per table because Postgres doesn't have policy templates)

-- companies / projects / sites / equipment / items / app_settings → Admin-only writes
do $$
declare t text;
begin
  for t in select unnest(array['companies','projects','sites','equipment','items','app_settings'])
  loop
    execute format($f$
      create policy "%1$s: read auth"  on public.%1$I for select to authenticated using (true);
      create policy "%1$s: admin write" on public.%1$I for all    to authenticated
        using (public.current_role() = 'Admin')
        with check (public.current_role() = 'Admin');
    $f$, t);
  end loop;
end $$;

-- stock_in: read-all; insert by Admin or Store Manager; update/delete Admin only
create policy "stock_in: read auth"   on public.stock_in for select to authenticated using (true);
create policy "stock_in: insert any"  on public.stock_in for insert to authenticated with check (public.current_role() in ('Admin','Store Manager'));
create policy "stock_in: admin write" on public.stock_in for update to authenticated using (public.current_role() = 'Admin') with check (public.current_role() = 'Admin');
create policy "stock_in: admin del"   on public.stock_in for delete to authenticated using (public.current_role() = 'Admin');

-- stock_out & stock_out_batches: writes happen *only* through the RPC, but we
-- still need RLS to permit the RPC's caller-context inserts. The RPC runs as
-- security invoker, so the caller's policies apply.
create policy "stock_out: read auth"   on public.stock_out for select to authenticated using (true);
create policy "stock_out: insert any"  on public.stock_out for insert to authenticated with check (public.current_role() in ('Admin','Store Manager'));
create policy "stock_out: admin write" on public.stock_out for update to authenticated using (public.current_role() = 'Admin') with check (public.current_role() = 'Admin');
create policy "stock_out: admin del"   on public.stock_out for delete to authenticated using (public.current_role() = 'Admin');

create policy "sob: read auth"   on public.stock_out_batches for select to authenticated using (true);
create policy "sob: insert any"  on public.stock_out_batches for insert to authenticated with check (public.current_role() in ('Admin','Store Manager'));
create policy "sob: admin del"   on public.stock_out_batches for delete to authenticated using (public.current_role() = 'Admin');

-- purchase_orders: same shape as stock_in
create policy "po: read auth"   on public.purchase_orders for select to authenticated using (true);
create policy "po: insert any"  on public.purchase_orders for insert to authenticated with check (public.current_role() in ('Admin','Store Manager'));
create policy "po: write any"   on public.purchase_orders for update to authenticated using (public.current_role() in ('Admin','Store Manager')) with check (public.current_role() in ('Admin','Store Manager'));
create policy "po: admin del"   on public.purchase_orders for delete to authenticated using (public.current_role() = 'Admin');

create policy "pol: read auth"  on public.purchase_order_lines for select to authenticated using (true);
create policy "pol: write any"  on public.purchase_order_lines for all to authenticated
  using (public.current_role() in ('Admin','Store Manager')) with check (public.current_role() in ('Admin','Store Manager'));

-- ─── Reusable views ─────────────────────────────────────────────────────────
-- Current stock per item (single source of truth for the dashboard).
create or replace view public.v_item_stock as
select
  i.id                         as item_id,
  i.name,
  i.category,
  i.unit,
  i.reorder_level,
  i.max_level,
  i.equipment_id,
  coalesce(sum(si.remaining_quantity), 0)              as current_quantity,
  coalesce(sum(si.remaining_quantity * si.unit_rate),0) as current_value,
  case
    when coalesce(sum(si.remaining_quantity),0) <= 0                then 'OUT_OF_STOCK'
    when coalesce(sum(si.remaining_quantity),0) <= i.reorder_level  then 'LOW'
    else 'OK'
  end as stock_status
from public.items i
left join public.stock_in si on si.item_id = i.id
group by i.id;

grant select on public.v_item_stock to authenticated;
