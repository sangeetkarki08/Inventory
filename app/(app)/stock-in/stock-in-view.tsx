'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowDownToLine, Search, AlertCircle } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { StockInForm } from './stock-in-form';
import { deleteStockIn } from '@/lib/actions/stock-in';
import { formatCurrency, cn } from '@/lib/utils';

interface StockInRow {
  id: number;
  received_at: string;
  quantity: number;
  unit_rate: number;
  vat_rate: number;
  base_amount: number;
  vat_amount: number;
  total_with_vat: number;
  remaining_quantity: number;
  supplier: string | null;
  description: string | null;
  item_id: number;
  project_id: number | null;
  items: { id: number; name: string; unit: string; category: string } | null;
  projects: { id: number; name: string } | null;
}

interface ItemOption {
  id: number;
  name: string;
  unit: string;
  category: string;
}

interface ProjectOption {
  id: number;
  name: string;
}

export function StockInView({
  batches,
  items,
  projects,
  defaultVatRate,
}: {
  batches: StockInRow[];
  items: ItemOption[];
  projects: ProjectOption[];
  defaultVatRate: number;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [itemFilter, setItemFilter] = useState('all');
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batches.filter((b) => {
      if (itemFilter !== 'all' && String(b.item_id) !== itemFilter) return false;
      if (q) {
        const hay = `${b.items?.name ?? ''} ${b.supplier ?? ''} ${b.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [batches, search, itemFilter]);

  // Top-line stats across all batches (post-filter).
  const stats = useMemo(() => {
    let totalValue = 0;
    let totalRemaining = 0;
    let depleted = 0;
    let active = 0;
    for (const b of filtered) {
      totalValue += Number(b.total_with_vat);
      totalRemaining += Number(b.remaining_quantity) * Number(b.unit_rate);
      if (Number(b.remaining_quantity) <= 0) depleted++;
      else active++;
    }
    return { totalValue, totalRemaining, depleted, active };
  }, [filtered]);

  function handleDelete(b: StockInRow) {
    if (
      !confirm(
        `Delete stock-in batch for "${b.items?.name ?? 'item'}"? This is only allowed if the batch hasn't been consumed yet.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteStockIn(b.id);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  const itemFilterOptions = [
    { value: 'all', label: 'All Items' },
    ...items.map((i) => ({ value: String(i.id), label: i.name })),
  ];

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock IN</h1>
          <p className="text-muted text-sm mt-1">
            Receipt batches — each row is a FIFO batch that future stock-outs will consume from
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          disabled={items.length === 0}
          title={items.length === 0 ? 'Create some items first' : undefined}
        >
          <Plus size={16} /> Record Stock IN
        </Button>
      </div>

      {items.length === 0 && (
        <div className="bg-info/10 border border-info/30 rounded-xl p-4 text-sm mb-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-info shrink-0 mt-0.5" />
          <div>
            <strong className="text-info">No items in your master yet.</strong>{' '}
            Go to <a href="/items" className="underline">Item Master</a> and create at least one item before
            recording stock-in.
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Receipts" value={String(filtered.length)} accent="info" />
        <StatCard label="Active Batches" value={String(stats.active)}    accent="success" />
        <StatCard label="Depleted Batches" value={String(stats.depleted)} accent="muted" />
        <StatCard label="Remaining Value" value={formatCurrency(stats.totalRemaining)} accent="amber" />
      </div>

      {/* Filters */}
      <div className="bg-panel border border-border rounded-2xl p-4 mb-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by item, supplier, or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-64">
          <Select
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value)}
            options={itemFilterOptions}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-panel border border-border rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowDownToLine className="mx-auto mb-3 text-muted" size={32} />
            <p className="text-sm text-muted">
              {batches.length === 0
                ? 'No stock-in records yet.'
                : 'No batches match your filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg/40 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Item</th>
                  <th className="px-4 py-3 text-right font-medium">Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Remaining</th>
                  <th className="px-4 py-3 text-right font-medium">Unit Rate</th>
                  <th className="px-4 py-3 text-right font-medium">VAT %</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-left font-medium">Supplier</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const remaining = Number(b.remaining_quantity);
                  const total = Number(b.quantity);
                  const consumed = total - remaining;
                  const isDepleted = remaining <= 0;
                  const isPartial  = consumed > 0 && remaining > 0;
                  return (
                    <tr key={b.id} className="border-t border-border/40 hover:bg-border/10">
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{b.received_at}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{b.items?.name ?? '—'}</div>
                        {b.projects && (
                          <div className="text-xs text-muted">{b.projects.name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {Number(b.quantity).toFixed(2)} {b.items?.unit}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            'inline-block px-2 py-0.5 rounded-md text-xs font-semibold',
                            isDepleted
                              ? 'bg-border/40 text-muted'
                              : isPartial
                                ? 'bg-accent/15 text-accent'
                                : 'bg-success/15 text-success',
                          )}
                        >
                          {remaining.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {formatCurrency(Number(b.unit_rate))}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {Number(b.vat_rate).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(Number(b.total_with_vat))}
                      </td>
                      <td className="px-4 py-3 text-muted truncate max-w-[160px]">
                        {b.supplier ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(b)}
                          disabled={isPending || consumed > 0}
                          title={consumed > 0 ? 'Cannot delete — partially consumed' : 'Delete batch'}
                          className="p-1.5 rounded hover:bg-danger/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={14} className="text-danger" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Stock IN" size="lg">
        {modalOpen && (
          <StockInForm
            items={items}
            projects={projects}
            defaultVatRate={defaultVatRate}
            onDone={() => {
              setModalOpen(false);
              router.refresh();
            }}
          />
        )}
      </Modal>
    </>
  );
}

function StatCard({
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
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}
