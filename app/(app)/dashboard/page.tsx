import {
  Package,
  Wallet,
  AlertTriangle,
  XCircle,
  Building2,
  MapPin,
  Wrench,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import type { StockStatus, ItemCategory, ItemUnit } from '@/types/database.types';

// Shape the view actually returns at runtime. We declare it explicitly because
// postgrest-js's strict generics resolve view queries to `never` for our
// installed version (2.105.x). The runtime data is unchanged.
interface VStockRow {
  item_id:          number | null;
  name:             string | null;
  category:         ItemCategory | null;
  unit:             ItemUnit | null;
  reorder_level:    number | null;
  max_level:        number | null;
  equipment_id:     number | null;
  current_quantity: number | null;
  current_value:    number | null;
  stock_status:     string | null;
}

function asStockStatus(s: string | null): StockStatus {
  if (s === 'LOW' || s === 'OUT_OF_STOCK') return s;
  return 'OK';
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [stockRes, sitesRes, projectsRes, equipmentRes] = await Promise.all([
    supabase.from('v_item_stock').select('*'),
    supabase.from('sites').select('id', { count: 'exact', head: true }),
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'Active'),
    supabase.from('equipment').select('id', { count: 'exact', head: true }).eq('status', 'Active'),
  ]);

  if (stockRes.error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm">
        ⚠ Failed to load dashboard: {stockRes.error.message}
      </div>
    );
  }

  // Cast the runtime data to our explicit row type. The two-step cast through
  // `unknown` is intentional — TS won't allow direct cast from `never[]`.
  const rawRows = (stockRes.data ?? []) as unknown as VStockRow[];

  const stock = rawRows.map((r) => ({
    item_id:          r.item_id ?? 0,
    name:             r.name ?? '',
    category:         (r.category ?? 'Consumable') as ItemCategory,
    unit:             (r.unit ?? 'Nos') as ItemUnit,
    reorder_level:    Number(r.reorder_level ?? 0),
    current_quantity: Number(r.current_quantity ?? 0),
    current_value:    Number(r.current_value ?? 0),
    stock_status:     asStockStatus(r.stock_status),
  }));

  const totalItems  = stock.length;
  const totalValue  = stock.reduce((s, r) => s + r.current_value, 0);
  const lowStock    = stock.filter((r) => r.stock_status === 'LOW');
  const outOfStock  = stock.filter((r) => r.stock_status === 'OUT_OF_STOCK');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted text-sm mt-1">
          Real-time inventory overview powered by the FIFO engine
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Kpi icon={<Package size={22} />}        label="Total Items"             value={totalItems.toString()}    accent="info" />
        <Kpi icon={<Wallet size={22} />}         label="Inventory Value (FIFO)"  value={formatCurrency(totalValue)} accent="success" />
        <Kpi icon={<AlertTriangle size={22} />}  label="Low Stock"               value={lowStock.length.toString()}  accent="amber" />
        <Kpi icon={<XCircle size={22} />}        label="Out of Stock"            value={outOfStock.length.toString()} accent="danger" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <SecondaryKpi icon={<Building2 size={18} />} label="Active Projects"  value={projectsRes.count ?? 0} />
        <SecondaryKpi icon={<MapPin size={18} />}    label="Sites"            value={sitesRes.count ?? 0} />
        <SecondaryKpi icon={<Wrench size={18} />}    label="Active Equipment" value={equipmentRes.count ?? 0} />
      </div>

      <div className="bg-panel border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Items Needing Attention</h2>
          <span className="text-xs text-muted">Reorder level reached or out of stock</span>
        </div>
        {lowStock.length + outOfStock.length === 0 ? (
          <div className="p-12 text-center text-muted text-sm">
            ✓ All items are well stocked.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg/40">
                <tr className="text-left text-muted text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 font-medium">Item</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium text-right">On Hand</th>
                  <th className="px-5 py-3 font-medium text-right">Reorder At</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...outOfStock, ...lowStock].map((row) => (
                  <tr key={row.item_id} className="border-t border-border/50">
                    <td className="px-5 py-3 font-medium">{row.name}</td>
                    <td className="px-5 py-3 text-muted">{row.category}</td>
                    <td className="px-5 py-3 text-right">
                      {row.current_quantity.toFixed(2)} {row.unit}
                    </td>
                    <td className="px-5 py-3 text-right text-muted">
                      {row.reorder_level.toFixed(2)} {row.unit}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={row.stock_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalItems === 0 && (
        <div className="mt-8 bg-info/10 border border-info/30 rounded-2xl p-5 text-sm">
          <strong className="text-info">Getting started:</strong> Your database is empty.
          Add your first <code className="px-1.5 py-0.5 bg-bg rounded">company → project → site → item</code>,
          then record stock-in batches to start tracking inventory.
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: 'info' | 'success' | 'amber' | 'danger';
}) {
  const accents = {
    info:    'text-info bg-info/10',
    success: 'text-success bg-success/10',
    amber:   'text-accent bg-accent/10',
    danger:  'text-danger bg-danger/10',
  } as const;
  return (
    <div className="bg-panel border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accents[accent]}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  );
}

function SecondaryKpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-panel border border-border rounded-xl p-4 flex items-center gap-3">
      <div className="text-muted">{icon}</div>
      <div className="flex-1">
        <div className="text-lg font-semibold">{value}</div>
        <div className="text-xs text-muted">{label}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: StockStatus }) {
  const map: Record<StockStatus, { cls: string; label: string }> = {
    OK:           { cls: 'bg-success/15 text-success', label: 'OK' },
    LOW:          { cls: 'bg-accent/15 text-accent',   label: 'LOW' },
    OUT_OF_STOCK: { cls: 'bg-danger/15 text-danger',   label: 'OUT' },
  };
  const m = map[status];
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}
