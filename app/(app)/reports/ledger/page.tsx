import Link from 'next/link';
import { ArrowLeft, BookOpen, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency, cn } from '@/lib/utils';
import { ItemPicker } from './item-picker';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ item?: string }>;
}

interface InRow {
  id: number;
  received_at: string;
  quantity: number;
  unit_rate: number;
  total_with_vat: number;
  remaining_quantity: number;
  supplier: string | null;
}

interface OutRow {
  id: number;
  issued_at: string;
  quantity: number;
  total_cost: number;
  issue_type: 'Consumption' | 'Transfer' | 'Tool Issue' | 'Return';
  sites: { id: number; name: string } | null;
}

interface ItemOption {
  id: number;
  name: string;
  unit: string;
  category: string;
}

export default async function LedgerReport({ searchParams }: PageProps) {
  const sp = await searchParams;
  const itemId = sp.item ? Number(sp.item) : null;

  const supabase = await createClient();

  const { data: items } = await supabase
    .from('items')
    .select('id, name, unit, category')
    .eq('is_active', true)
    .order('name', { ascending: true });

  const itemOptions = (items ?? []) as unknown as ItemOption[];
  const selectedItem = itemId ? itemOptions.find((i) => i.id === itemId) : null;

  if (!itemId || !selectedItem) {
    return (
      <div>
        <BackLink />
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <BookOpen size={22} className="text-info" />
            <h1 className="text-2xl font-bold">Item Ledger</h1>
          </div>
          <p className="text-muted text-sm">
            Pick an item to see its complete in/out history with running balance.
          </p>
        </div>

        <div className="bg-panel border border-border rounded-2xl p-6">
          <label className="block text-sm font-medium mb-2">Select Item</label>
          <ItemPicker items={itemOptions} />
        </div>
      </div>
    );
  }

  const [inRes, outRes] = await Promise.all([
    supabase
      .from('stock_in')
      .select('id, received_at, quantity, unit_rate, total_with_vat, remaining_quantity, supplier')
      .eq('item_id', itemId)
      .order('received_at', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('stock_out')
      .select('id, issued_at, quantity, total_cost, issue_type, sites(id, name)')
      .eq('item_id', itemId)
      .order('issued_at', { ascending: true })
      .order('id', { ascending: true }),
  ]);

  const inRows  = (inRes.data  ?? []) as unknown as InRow[];
  const outRows = (outRes.data ?? []) as unknown as OutRow[];

  type TimelineEntry =
    | { kind: 'in';  date: string; sortKey: string; data: InRow }
    | { kind: 'out'; date: string; sortKey: string; data: OutRow };

  const timeline: TimelineEntry[] = [
    ...inRows.map((r): TimelineEntry => ({
      kind: 'in',
      date: r.received_at,
      sortKey: `${r.received_at}-in-${String(r.id).padStart(10, '0')}`,
      data: r,
    })),
    ...outRows.map((r): TimelineEntry => ({
      kind: 'out',
      date: r.issued_at,
      sortKey: `${r.issued_at}-out-${String(r.id).padStart(10, '0')}`,
      data: r,
    })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  let runningBalance = 0;
  let totalInQty = 0;
  let totalOutQty = 0;
  let totalInValue = 0;
  let totalOutValue = 0;

  const enriched = timeline.map((entry) => {
    if (entry.kind === 'in') {
      const q = Number(entry.data.quantity);
      runningBalance += q;
      totalInQty += q;
      totalInValue += Number(entry.data.total_with_vat);
    } else {
      const q = Number(entry.data.quantity);
      runningBalance -= q;
      totalOutQty += q;
      totalOutValue += Number(entry.data.total_cost);
    }
    return { ...entry, balance: runningBalance };
  });

  return (
    <div>
      <BackLink />
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <BookOpen size={22} className="text-info" />
            <h1 className="text-2xl font-bold">Item Ledger</h1>
          </div>
          <p className="text-muted text-sm">
            <strong className="text-text">{selectedItem.name}</strong>{' '}
            <span className="text-xs">({selectedItem.category}, {selectedItem.unit})</span>
          </p>
        </div>
        <div className="w-72 shrink-0">
          <ItemPicker items={itemOptions} selectedId={itemId} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat
          label="Total Received"
          value={`${totalInQty.toFixed(2)} ${selectedItem.unit}`}
          accent="success"
        />
        <Stat
          label="Total Issued"
          value={`${totalOutQty.toFixed(2)} ${selectedItem.unit}`}
          accent="amber"
        />
        <Stat
          label="Current Balance"
          value={`${runningBalance.toFixed(2)} ${selectedItem.unit}`}
          accent={runningBalance > 0 ? 'info' : 'muted'}
        />
        <Stat
          label="Net Cost (In − Out)"
          value={formatCurrency(totalInValue - totalOutValue)}
          accent="muted"
        />
      </div>

      <div className="bg-panel border border-border rounded-2xl overflow-hidden">
        {enriched.length === 0 ? (
          <div className="p-12 text-center text-muted text-sm">
            No transactions recorded for this item yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg/40 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium">In</th>
                  <th className="px-4 py-3 text-right font-medium">Out</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                  <th className="px-4 py-3 text-left font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((entry) => {
                  if (entry.kind === 'in') {
                    return (
                      <tr key={entry.sortKey} className="border-t border-border/40">
                        <td className="px-4 py-3 text-muted whitespace-nowrap">{entry.date}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-success text-xs font-semibold">
                            <ArrowDownToLine size={12} />
                            Stock IN
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-success font-medium">
                          +{Number(entry.data.quantity).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">—</td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {entry.balance.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {formatCurrency(Number(entry.data.total_with_vat))}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {entry.data.supplier
                            ? `From: ${entry.data.supplier}`
                            : <span className="text-muted/60">No supplier</span>}
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={entry.sortKey} className="border-t border-border/40">
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{entry.date}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-accent text-xs font-semibold">
                          <ArrowUpFromLine size={12} />
                          {entry.data.issue_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted">—</td>
                      <td className="px-4 py-3 text-right text-accent font-medium">
                        −{Number(entry.data.quantity).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {entry.balance.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {formatCurrency(Number(entry.data.total_cost))}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        To: {entry.data.sites?.name ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
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

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'info' | 'success' | 'amber' | 'muted';
}) {
  const accents = {
    info:    'border-info/40    text-info',
    success: 'border-success/40 text-success',
    amber:   'border-accent/40  text-accent',
    muted:   'border-border     text-muted',
  } as const;
  return (
    <div className={cn('bg-panel border-l-4 border-y border-r border-border rounded-xl p-4', accents[accent])}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}
