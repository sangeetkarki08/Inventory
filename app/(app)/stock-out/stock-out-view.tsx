'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ArrowUpFromLine, Search, AlertCircle } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { StockOutForm } from './stock-out-form';
import { formatCurrency, cn } from '@/lib/utils';

type IssueType = 'Consumption' | 'Transfer' | 'Tool Issue' | 'Return';

interface StockOutRow {
  id: number;
  issued_at: string;
  quantity: number;
  total_cost: number;
  issue_type: IssueType;
  description: string | null;
  item_id: number;
  site_id: number;
  items: { id: number; name: string; unit: string } | null;
  sites: { id: number; name: string; type: string } | null;
}

interface ItemWithStock {
  id: number;
  name: string;
  unit: string;
  category: string;
  available: number;
}

interface SiteOption {
  id: number;
  name: string;
  type: string;
}

const TYPE_FILTER_OPTIONS = [
  { value: 'all',          label: 'All Types' },
  { value: 'Consumption',  label: 'Consumption' },
  { value: 'Transfer',     label: 'Transfer' },
  { value: 'Tool Issue',   label: 'Tool Issue' },
  { value: 'Return',       label: 'Return' },
];

export function StockOutView({
  issues,
  items,
  sites,
}: {
  issues: StockOutRow[];
  items: ItemWithStock[];
  sites: SiteOption[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((i) => {
      if (typeFilter !== 'all' && i.issue_type !== typeFilter) return false;
      if (q) {
        const hay = `${i.items?.name ?? ''} ${i.sites?.name ?? ''} ${i.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [issues, search, typeFilter]);

  const stats = useMemo(() => {
    let totalCost = 0;
    const counts: Record<IssueType, number> = {
      Consumption: 0, Transfer: 0, 'Tool Issue': 0, Return: 0,
    };
    for (const i of filtered) {
      totalCost += Number(i.total_cost);
      counts[i.issue_type]++;
    }
    return { totalCost, counts };
  }, [filtered]);

  const itemsAvailableCount = items.filter((i) => i.available > 0).length;

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock OUT</h1>
          <p className="text-muted text-sm mt-1">
            Issues from inventory, valued via FIFO across receipt batches
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          disabled={itemsAvailableCount === 0}
          title={itemsAvailableCount === 0 ? 'No items have stock available' : undefined}
        >
          <Plus size={16} /> Issue Stock
        </Button>
      </div>

      {itemsAvailableCount === 0 && (
        <div className="bg-info/10 border border-info/30 rounded-xl p-4 text-sm mb-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-info shrink-0 mt-0.5" />
          <div>
            <strong className="text-info">No stock available to issue.</strong>{' '}
            Go to <a href="/stock-in" className="underline">Stock IN</a> and record receipts first.
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Issues" value={String(filtered.length)} accent="info" />
        <StatCard label="Consumption" value={String(stats.counts.Consumption)} accent="success" />
        <StatCard label="Tool Issues" value={String(stats.counts['Tool Issue'])} accent="amber" />
        <StatCard label="Total Issue Cost (FIFO)" value={formatCurrency(stats.totalCost)} accent="muted" />
      </div>

      {/* Filters */}
      <div className="bg-panel border border-border rounded-2xl p-4 mb-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by item, site, or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-48">
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={TYPE_FILTER_OPTIONS}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-panel border border-border rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowUpFromLine className="mx-auto mb-3 text-muted" size={32} />
            <p className="text-sm text-muted">
              {issues.length === 0
                ? 'No stock-out records yet.'
                : 'No issues match your filters.'}
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
                  <th className="px-4 py-3 text-left font-medium">Issue Type</th>
                  <th className="px-4 py-3 text-left font-medium">Site</th>
                  <th className="px-4 py-3 text-right font-medium">Cost (FIFO)</th>
                  <th className="px-4 py-3 text-left font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} className="border-t border-border/40 hover:bg-border/10">
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{i.issued_at}</td>
                    <td className="px-4 py-3 font-medium">{i.items?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {Number(i.quantity).toFixed(2)} {i.items?.unit}
                    </td>
                    <td className="px-4 py-3">
                      <IssueTypeBadge type={i.issue_type} />
                    </td>
                    <td className="px-4 py-3 text-muted">{i.sites?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(Number(i.total_cost))}
                    </td>
                    <td className="px-4 py-3 text-muted truncate max-w-[200px]">
                      {i.description ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Issue Stock" size="lg">
        {modalOpen && (
          <StockOutForm
            items={items}
            sites={sites}
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

function IssueTypeBadge({ type }: { type: IssueType }) {
  const map: Record<IssueType, string> = {
    Consumption:  'bg-success/15 text-success',
    Transfer:     'bg-info/15 text-info',
    'Tool Issue': 'bg-accent/15 text-accent',
    Return:       'bg-border/40 text-muted',
  };
  return (
    <span className={cn('inline-block px-2 py-0.5 rounded-md text-xs font-semibold', map[type])}>
      {type}
    </span>
  );
}
