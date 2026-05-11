import Link from 'next/link';
import { ArrowLeft, Coins } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency, cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Category = 'Consumable' | 'Tools' | 'Equipment' | 'Spare Parts';

interface StockRow {
  item_id: number | null;
  name: string | null;
  category: Category | null;
  unit: string | null;
  current_quantity: number | null;
  current_value: number | null;
  stock_status: string | null;
}

const VIEW_COLS =
  'item_id, name, category, unit, current_quantity, current_value, stock_status';

export default async function ValuationReport() {
  const supabase = await createClient();

  const stockRes = await supabase.from('v_item_stock').select(VIEW_COLS);

  if (stockRes.error) {
    return (
      <div>
        <BackLink />
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm">
          ⚠ Failed to load valuation: {stockRes.error.message}
        </div>
      </div>
    );
  }

  const rows = ((stockRes.data ?? []) as unknown as StockRow[])
    .map((r) => ({
      item_id:          r.item_id ?? 0,
      name:             r.name ?? '',
      category:         (r.category ?? 'Consumable') as Category,
      unit:             r.unit ?? '',
      current_quantity: Number(r.current_quantity ?? 0),
      current_value:    Number(r.current_value ?? 0),
      has_stock:        Number(r.current_quantity ?? 0) > 0,
    }))
    // Hide zero-stock items from valuation (they contribute 0).
    .filter((r) => r.has_stock);

  // Group by category.
  const byCategory: Record<Category, typeof rows> = {
    Consumable: [], Tools: [], Equipment: [], 'Spare Parts': [],
  };
  for (const r of rows) byCategory[r.category].push(r);

  // Compute category totals.
  const categoryTotals: Record<Category, { count: number; value: number }> = {
    Consumable:    { count: 0, value: 0 },
    Tools:         { count: 0, value: 0 },
    Equipment:     { count: 0, value: 0 },
    'Spare Parts': { count: 0, value: 0 },
  };
  for (const r of rows) {
    categoryTotals[r.category].count++;
    categoryTotals[r.category].value += r.current_value;
  }

  const grandTotal = rows.reduce((s, r) => s + r.current_value, 0);

  // Categories sorted by value descending so the biggest contributors are first.
  const categories: Category[] = (Object.keys(byCategory) as Category[]).sort(
    (a, b) => categoryTotals[b].value - categoryTotals[a].value,
  );

  return (
    <div>
      <BackLink />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Coins size={22} className="text-success" />
            <h1 className="text-2xl font-bold">Stock Valuation</h1>
          </div>
          <p className="text-muted text-sm">
            Current FIFO inventory value across all items, grouped by category
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Grand Total</div>
          <div className="text-2xl font-bold text-success">
            {formatCurrency(grandTotal)}
          </div>
        </div>
      </div>

      {/* Category mix */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {(Object.entries(categoryTotals) as Array<[Category, { count: number; value: number }]>).map(
          ([cat, data]) => {
            const pct = grandTotal > 0 ? (data.value / grandTotal) * 100 : 0;
            const accents: Record<Category, string> = {
              Consumable:   'border-success/40 text-success',
              Tools:        'border-info/40    text-info',
              Equipment:    'border-accent/40  text-accent',
              'Spare Parts':'border-border     text-muted',
            };
            return (
              <div
                key={cat}
                className={cn(
                  'bg-panel border-l-4 border-y border-r border-border rounded-xl p-4',
                  accents[cat],
                )}
              >
                <div className="text-xs text-muted mb-1">{cat}</div>
                <div className="text-lg font-bold">{formatCurrency(data.value)}</div>
                <div className="text-xs text-muted mt-0.5">
                  {data.count} item{data.count === 1 ? '' : 's'} · {pct.toFixed(1)}%
                </div>
              </div>
            );
          },
        )}
      </div>

      {rows.length === 0 ? (
        <div className="bg-panel border border-border rounded-2xl p-12 text-center text-muted text-sm">
          No items have stock currently. Record some Stock IN to populate this report.
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => {
            const items = byCategory[cat];
            if (items.length === 0) return null;
            return (
              <div
                key={cat}
                className="bg-panel border border-border rounded-2xl overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-border bg-bg/30 flex items-center justify-between">
                  <h3 className="font-semibold">{cat}</h3>
                  <span className="text-sm text-muted">
                    {items.length} items · {formatCurrency(categoryTotals[cat].value)}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-bg/40 text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-5 py-2.5 text-left font-medium">Item</th>
                      <th className="px-5 py-2.5 text-right font-medium">Quantity</th>
                      <th className="px-5 py-2.5 text-right font-medium">Avg Rate</th>
                      <th className="px-5 py-2.5 text-right font-medium">Value</th>
                      <th className="px-5 py-2.5 text-right font-medium">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items
                      .sort((a, b) => b.current_value - a.current_value)
                      .map((r) => {
                        const avgRate =
                          r.current_quantity > 0
                            ? r.current_value / r.current_quantity
                            : 0;
                        const pctOfTotal =
                          grandTotal > 0
                            ? (r.current_value / grandTotal) * 100
                            : 0;
                        return (
                          <tr key={r.item_id} className="border-t border-border/40">
                            <td className="px-5 py-2.5 font-medium">{r.name}</td>
                            <td className="px-5 py-2.5 text-right text-muted">
                              {r.current_quantity.toFixed(2)} {r.unit}
                            </td>
                            <td className="px-5 py-2.5 text-right text-muted">
                              {formatCurrency(avgRate)}
                            </td>
                            <td className="px-5 py-2.5 text-right font-semibold">
                              {formatCurrency(r.current_value)}
                            </td>
                            <td className="px-5 py-2.5 text-right text-muted text-xs">
                              {pctOfTotal.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/reports"
      className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition mb-4"
    >
      <ArrowLeft size={14} />
      Back to Reports
    </Link>
  );
}
