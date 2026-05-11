'use client';

import { useState, useMemo } from 'react';
import {
  Scale, Search, ArrowDownToLine, ArrowUpFromLine, Package, AlertTriangle,
  Wallet, Boxes, TrendingDown, AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/form';
import { formatCurrency, cn } from '@/lib/utils';

type Category = 'Consumable' | 'Tools' | 'Equipment' | 'Spare Parts';

interface ItemRow {
  id: number;
  name: string;
  category: Category;
  unit: string;
  reorder_level: number;
}

interface InRow {
  id: number;
  item_id: number;
  received_at: string;
  quantity: number;
  unit_rate: number;
  total_with_vat: number;
  supplier: string | null;
}

interface OutRow {
  id: number;
  item_id: number;
  issued_at: string;
  quantity: number;
  total_cost: number;
  issue_type: 'Consumption' | 'Transfer' | 'Tool Issue' | 'Return';
  sites: { id: number; name: string } | null;
}

type LedgerEntry =
  | {
      kind: 'in';
      sortKey: string;
      date: string;
      qty: number;
      unitRate: number;
      value: number;
      reference: string;
      runningBalance: number;
      runningValue: number;
    }
  | {
      kind: 'out';
      sortKey: string;
      date: string;
      qty: number;
      unitRate: number;
      value: number;
      reference: string;
      runningBalance: number;
      runningValue: number;
    };

interface ItemWithLedger {
  item: ItemRow;
  entries: LedgerEntry[];
  currentBalance: number;
  currentValue: number;
  totalIn: number;
  totalOut: number;
}

export function BalanceView({
  items,
  inRows,
  outRows,
}: {
  items: ItemRow[];
  inRows: InRow[];
  outRows: OutRow[];
}) {
  const [search, setSearch] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);

  const itemsWithLedger = useMemo<ItemWithLedger[]>(() => {
    const inByItem  = new Map<number, InRow[]>();
    const outByItem = new Map<number, OutRow[]>();
    for (const r of inRows)  {
      const list = inByItem.get(r.item_id) ?? [];
      list.push(r);
      inByItem.set(r.item_id, list);
    }
    for (const r of outRows) {
      const list = outByItem.get(r.item_id) ?? [];
      list.push(r);
      outByItem.set(r.item_id, list);
    }

    return items.map((item) => {
      const ins  = inByItem.get(item.id)  ?? [];
      const outs = outByItem.get(item.id) ?? [];

      const merged: LedgerEntry[] = [
        ...ins.map((r) => ({
          kind: 'in' as const,
          sortKey: `${r.received_at}-1in-${String(r.id).padStart(10, '0')}`,
          date: r.received_at,
          qty: Number(r.quantity),
          unitRate: Number(r.unit_rate),
          value: Number(r.total_with_vat),
          reference: r.supplier ?? '—',
          runningBalance: 0,
          runningValue: 0,
        })),
        ...outs.map((r) => ({
          kind: 'out' as const,
          sortKey: `${r.issued_at}-2out-${String(r.id).padStart(10, '0')}`,
          date: r.issued_at,
          qty: Number(r.quantity),
          unitRate: Number(r.quantity) > 0 ? Number(r.total_cost) / Number(r.quantity) : 0,
          value: Number(r.total_cost),
          reference: `${r.issue_type}${r.sites?.name ? ' → ' + r.sites.name : ''}`,
          runningBalance: 0,
          runningValue: 0,
        })),
      ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

      let bal = 0;
      let val = 0;
      let totalIn = 0;
      let totalOut = 0;

      for (const e of merged) {
        if (e.kind === 'in') {
          bal += e.qty;
          val += e.value;
          totalIn += e.qty;
        } else {
          bal -= e.qty;
          val -= e.value;
          totalOut += e.qty;
        }
        e.runningBalance = bal;
        e.runningValue = val;
      }

      return {
        item,
        entries: merged,
        currentBalance: bal,
        currentValue: Math.max(0, val),
        totalIn,
        totalOut,
      };
    });
  }, [items, inRows, outRows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return itemsWithLedger.filter((iwl) => {
      if (!showEmpty && iwl.entries.length === 0) return false;
      if (q && !iwl.item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [itemsWithLedger, search, showEmpty]);

  const stats = useMemo(() => {
    let totalValue = 0;
    let inStock = 0;
    let outOfStock = 0;
    let lowStock = 0;
    for (const iwl of itemsWithLedger) {
      totalValue += iwl.currentValue;
      if (iwl.currentBalance <= 0)                                          outOfStock++;
      else if (iwl.currentBalance <= Number(iwl.item.reorder_level))        lowStock++;
      else                                                                  inStock++;
    }
    return { totalValue, inStock, outOfStock, lowStock };
  }, [itemsWithLedger]);

  return (
    <>
      {/* ── Header with subtitle pill ────────────────────────────────────── */}
      <div className="section-heading">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center">
              <Scale size={18} className="text-accent" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Stock Balance</h1>
            <span className="pill pill-amber">
              {visible.length} {visible.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <p className="text-muted text-sm ml-12">
            Per-item transaction ledger with running balance and remaining stock
          </p>
        </div>
      </div>

      {/* ── KPI cards with colored glows ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard
          icon={<Wallet size={16} />}
          label="Total Inventory Value"
          value={formatCurrency(stats.totalValue)}
          color="success"
        />
        <KpiCard
          icon={<Boxes size={16} />}
          label="Items in Stock"
          value={String(stats.inStock)}
          color="info"
        />
        <KpiCard
          icon={<TrendingDown size={16} />}
          label="Low Stock"
          value={String(stats.lowStock)}
          color="amber"
        />
        <KpiCard
          icon={<AlertCircle size={16} />}
          label="Out of Stock"
          value={String(stats.outOfStock)}
          color="danger"
        />
      </div>

      {/* ── Compact search bar with right-side toggle ────────────────────── */}
      <div className="card p-3 mb-6 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search items by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-full pl-9 pr-3 py-2 rounded-lg text-sm
              bg-bg/40 border border-transparent
              placeholder:text-muted/60
              transition-all duration-150
              hover:border-border
              focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 focus:bg-bg
            "
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none whitespace-nowrap text-muted hover:text-text transition px-3">
          <input
            type="checkbox"
            checked={showEmpty}
            onChange={(e) => setShowEmpty(e.target.checked)}
            className="rounded border-border bg-bg text-accent focus:ring-accent"
          />
          Show items with no transactions
        </label>
      </div>

      {/* ── Item cards ───────────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="card p-12 text-center">
          <Package className="mx-auto mb-3 text-muted" size={32} />
          <p className="text-sm text-muted">
            {itemsWithLedger.length === 0
              ? 'No items in your master yet. Create some items first.'
              : search
                ? 'No items match your search.'
                : 'No items with transactions yet. Record some Stock IN to start tracking.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {visible.map((iwl) => (
            <ItemBalanceCard key={iwl.item.id} data={iwl} />
          ))}
        </div>
      )}
    </>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────
function KpiCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'info' | 'success' | 'amber' | 'danger';
}) {
  const colorMap = {
    info:    { glow: 'rgb(96 165 250 / 0.15)', icon: 'bg-info/15    text-info border-info/30',       border: 'border-l-info/40' },
    success: { glow: 'rgb(52 211 153 / 0.15)', icon: 'bg-success/15 text-success border-success/30', border: 'border-l-success/40' },
    amber:   { glow: 'rgb(245 158 11 / 0.15)', icon: 'bg-accent/15  text-accent border-accent/30',   border: 'border-l-accent/40' },
    danger:  { glow: 'rgb(248 113 113 / 0.15)', icon: 'bg-danger/15  text-danger border-danger/30',   border: 'border-l-danger/40' },
  } as const;

  const c = colorMap[color];

  return (
    <div
      className={cn('stat-card border-l-4', c.border)}
      style={{ ['--stat-glow' as string]: c.glow }}
    >
      <div className="relative flex items-start justify-between mb-3">
        <div className={cn('w-8 h-8 rounded-lg border flex items-center justify-center', c.icon)}>
          {icon}
        </div>
      </div>
      <div className="relative">
        <div className="text-2xl font-bold tabular-nums tracking-tight">{value}</div>
        <div className="text-xs text-muted mt-1 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

// ─── Per-item card ─────────────────────────────────────────────────────────
function ItemBalanceCard({ data }: { data: ItemWithLedger }) {
  const { item, entries, currentBalance, currentValue, totalIn, totalOut } = data;

  const reorder = Number(item.reorder_level);
  let status: 'out' | 'low' | 'ok' = 'ok';
  if (currentBalance <= 0) status = 'out';
  else if (currentBalance <= reorder) status = 'low';

  const remainingTheme = {
    out: { bg: 'bg-danger/10',  border: 'border-danger/40',  text: 'text-danger',  label: 'text-danger/80'  },
    low: { bg: 'bg-accent/10',  border: 'border-accent/40',  text: 'text-accent',  label: 'text-accent/80'  },
    ok:  { bg: 'bg-success/10', border: 'border-success/40', text: 'text-success', label: 'text-success/80' },
  }[status];

  return (
    <div className="card-elevated card-hover overflow-hidden">
      {/* ── Card header ──────────────────────────────────────────────────── */}
      <div className="
        relative px-5 py-4 border-b border-border
        bg-gradient-to-br from-surface/60 to-transparent
        flex flex-wrap items-center justify-between gap-4
      ">
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-bg/60 border border-border flex items-center justify-center">
              <Package size={15} className="text-muted" />
            </div>
            <h2 className="font-semibold text-lg tracking-tight">{item.name}</h2>
            <CategoryBadge category={item.category} />
            {status === 'out' && (
              <span className="pill pill-danger">
                <AlertTriangle size={11} />
                Out of Stock
              </span>
            )}
            {status === 'low' && (
              <span className="pill pill-amber">
                <AlertTriangle size={11} />
                Low Stock
              </span>
            )}
          </div>
          <div className="text-xs text-muted flex flex-wrap gap-x-4 gap-y-1 ml-10">
            <span>Unit: <span className="text-text">{item.unit}</span></span>
            <span>Reorder: <span className="text-text tabular-nums">{reorder.toFixed(2)}</span></span>
            <span className="text-success">↓ Received {totalIn.toFixed(2)}</span>
            <span className="text-accent">↑ Issued {totalOut.toFixed(2)}</span>
          </div>
        </div>

        {/* PROMINENT REMAINING PANEL */}
        <div className={cn(
          'rounded-xl px-5 py-3 border-2 min-w-[200px]',
          remainingTheme.bg,
          remainingTheme.border,
        )}>
          <div className={cn('text-[10px] uppercase tracking-widest font-bold mb-0.5', remainingTheme.label)}>
            Remaining
          </div>
          <div className={cn('text-3xl font-bold leading-tight tabular-nums', remainingTheme.text)}>
            {currentBalance.toFixed(2)}
            <span className="text-base font-medium ml-1.5 opacity-80">{item.unit}</span>
          </div>
          <div className="text-xs text-muted mt-1">
            Value: <span className="text-text tabular-nums">{formatCurrency(currentValue)}</span>
          </div>
        </div>
      </div>

      {/* ── Ledger table (zebra stripes + hover) ────────────────────────── */}
      {entries.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted">
          No transactions for this item yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-zebra">
            <thead className="bg-bg/40 text-[10px] uppercase tracking-widest text-muted/80">
              <tr>
                <th className="px-5 py-3 text-left  font-semibold">Date</th>
                <th className="px-5 py-3 text-left  font-semibold">Type</th>
                <th className="px-5 py-3 text-right font-semibold">Qty</th>
                <th className="px-5 py-3 text-right font-semibold">Unit Rate</th>
                <th className="px-5 py-3 text-right font-semibold">Value</th>
                <th className="px-5 py-3 text-right font-semibold">Running Balance</th>
                <th className="px-5 py-3 text-left  font-semibold">Reference</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={`${e.kind}-${e.sortKey}`}
                  className="border-t border-border/30 transition-colors"
                >
                  <td className="px-5 py-2.5 text-muted whitespace-nowrap font-mono text-xs">
                    {e.date}
                  </td>
                  <td className="px-5 py-2.5">
                    {e.kind === 'in' ? (
                      <span className="inline-flex items-center gap-1.5 text-success text-xs font-bold">
                        <ArrowDownToLine size={12} />
                        IN
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-accent text-xs font-bold">
                        <ArrowUpFromLine size={12} />
                        OUT
                      </span>
                    )}
                  </td>
                  <td className={cn(
                    'px-5 py-2.5 text-right font-semibold tabular-nums',
                    e.kind === 'in' ? 'text-success' : 'text-accent',
                  )}>
                    {e.kind === 'in' ? '+' : '−'}{e.qty.toFixed(2)}
                  </td>
                  <td className="px-5 py-2.5 text-right text-muted tabular-nums">
                    {formatCurrency(e.unitRate)}
                  </td>
                  <td className={cn(
                    'px-5 py-2.5 text-right tabular-nums',
                    e.kind === 'in' ? 'text-success' : 'text-accent',
                  )}>
                    {e.kind === 'in' ? '+' : '−'}{formatCurrency(e.value)}
                  </td>
                  <td className="px-5 py-2.5 text-right font-bold tabular-nums">
                    {e.runningBalance.toFixed(2)}
                    <span className="text-muted text-xs ml-1 font-normal">{item.unit}</span>
                  </td>
                  <td className="px-5 py-2.5 text-muted text-xs truncate max-w-[200px]">
                    {e.reference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CategoryBadge({ category }: { category: Category }) {
  const map: Record<Category, string> = {
    Consumable:    'pill-success',
    Tools:         'pill-info',
    Equipment:     'pill-amber',
    'Spare Parts': 'pill-muted',
  };
  return <span className={cn('pill', map[category])}>{category}</span>;
}
