'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, ClipboardList, Search, Trash2, AlertTriangle,
  ChevronDown, ChevronRight, Sparkles,
} from 'lucide-react';
import { Button, Input, Select } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { PurchaseOrderForm } from './purchase-order-form';
import { updatePoStatus, deletePurchaseOrder } from '@/lib/actions/purchase-orders';
import { formatCurrency, cn } from '@/lib/utils';

type PoStatus = 'Draft' | 'Sent' | 'Partially Received' | 'Received' | 'Cancelled';

interface POLine {
  id: number;
  item_id: number;
  quantity: number;
  unit_rate: number;
  line_total: number;
  items: { id: number; name: string; unit: string } | null;
}

interface PurchaseOrderRow {
  id: number;
  po_number: string;
  supplier: string;
  status: PoStatus;
  ordered_at: string;
  expected_at: string | null;
  notes: string | null;
  total_amount: number;
  purchase_order_lines: POLine[];
}

interface ItemSuggestion {
  id: number;
  name: string;
  unit: string;
  reorder_level: number;
  max_level: number;
  preferred_supplier: string | null;
  current_quantity: number;
  shortage: number;
}

interface ItemOption {
  id: number;
  name: string;
  unit: string;
  preferred_supplier: string | null;
}

const STATUS_OPTIONS = [
  { value: 'all',                label: 'All Statuses' },
  { value: 'Draft',              label: 'Draft' },
  { value: 'Sent',               label: 'Sent' },
  { value: 'Partially Received', label: 'Partially Received' },
  { value: 'Received',           label: 'Received' },
  { value: 'Cancelled',          label: 'Cancelled' },
];

const STATUS_TRANSITIONS: Record<PoStatus, PoStatus[]> = {
  Draft:                 ['Sent', 'Cancelled'],
  Sent:                  ['Partially Received', 'Received', 'Cancelled'],
  'Partially Received':  ['Received', 'Cancelled'],
  Received:              [],
  Cancelled:             [],
};

export function PurchaseOrdersView({
  purchaseOrders,
  suggestions,
  itemOptions,
}: {
  purchaseOrders: PurchaseOrderRow[];
  suggestions: ItemSuggestion[];
  itemOptions: ItemOption[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [seedFromSuggestions, setSeedFromSuggestions] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return purchaseOrders.filter((po) => {
      if (statusFilter !== 'all' && po.status !== statusFilter) return false;
      if (q) {
        const hay = `${po.po_number} ${po.supplier} ${po.notes ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [purchaseOrders, search, statusFilter]);

  const stats = useMemo(() => {
    let totalValue = 0;
    const counts: Record<PoStatus, number> = {
      Draft: 0, Sent: 0, 'Partially Received': 0, Received: 0, Cancelled: 0,
    };
    for (const po of purchaseOrders) {
      counts[po.status]++;
      if (po.status !== 'Cancelled') totalValue += Number(po.total_amount);
    }
    return { totalValue, counts };
  }, [purchaseOrders]);

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleStatusChange(po: PurchaseOrderRow, newStatus: PoStatus) {
    startTransition(async () => {
      const res = await updatePoStatus(po.id, newStatus);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  function handleDelete(po: PurchaseOrderRow) {
    if (!confirm(`Delete PO "${po.po_number}"? Only Draft and Cancelled POs can be deleted.`)) return;
    startTransition(async () => {
      const res = await deletePurchaseOrder(po.id);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  function openGenerator(seedFromSuggestions: boolean) {
    setSeedFromSuggestions(seedFromSuggestions);
    setModalOpen(true);
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-muted text-sm mt-1">
            Generate, send, and track POs through their procurement lifecycle
          </p>
        </div>
        <Button onClick={() => openGenerator(false)}>
          <Plus size={16} /> New PO
        </Button>
      </div>

      {/* PO Generator suggestion banner */}
      {suggestions.length > 0 && (
        <div className="bg-accent/10 border border-accent/30 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <Sparkles size={20} className="text-accent shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-accent mb-1">
              {suggestions.length} item{suggestions.length === 1 ? '' : 's'} below reorder level
            </div>
            <div className="text-sm text-muted">
              Auto-generate a PO with suggested quantities (max level − current stock) to refill inventory.
            </div>
          </div>
          <Button onClick={() => openGenerator(true)}>
            <Sparkles size={14} /> Generate PO
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Drafts"        value={String(stats.counts.Draft)}   accent="muted" />
        <StatCard label="Sent"          value={String(stats.counts.Sent)}    accent="info" />
        <StatCard label="Received"      value={String(stats.counts.Received)} accent="success" />
        <StatCard label="Open Value"    value={formatCurrency(stats.totalValue)} accent="amber" />
      </div>

      {/* Filters */}
      <div className="bg-panel border border-border rounded-2xl p-4 mb-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by PO number, supplier, or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-56">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-panel border border-border rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="mx-auto mb-3 text-muted" size={32} />
            <p className="text-sm text-muted">
              {purchaseOrders.length === 0
                ? 'No purchase orders yet.'
                : 'No POs match your filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg/40 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-3 w-10"></th>
                  <th className="px-4 py-3 text-left font-medium">PO #</th>
                  <th className="px-4 py-3 text-left font-medium">Supplier</th>
                  <th className="px-4 py-3 text-left font-medium">Ordered</th>
                  <th className="px-4 py-3 text-left font-medium">Expected</th>
                  <th className="px-4 py-3 text-right font-medium">Lines</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((po) => {
                  const isOpen = expanded.has(po.id);
                  const transitions = STATUS_TRANSITIONS[po.status];
                  return (
                    <>
                      <tr
                        key={po.id}
                        className="border-t border-border/40 hover:bg-border/10 cursor-pointer"
                        onClick={() => toggleExpand(po.id)}
                      >
                        <td className="px-3 py-3 text-muted">
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold">
                          {po.po_number}
                        </td>
                        <td className="px-4 py-3">{po.supplier}</td>
                        <td className="px-4 py-3 text-muted whitespace-nowrap">{po.ordered_at}</td>
                        <td className="px-4 py-3 text-muted whitespace-nowrap">
                          {po.expected_at ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {po.purchase_order_lines.length}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(Number(po.total_amount))}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={po.status} />
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex gap-1 items-center">
                            {transitions.length > 0 && (
                              <div className="w-44">
                                <Select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleStatusChange(po, e.target.value as PoStatus);
                                    }
                                  }}
                                  options={[
                                    { value: '', label: 'Move to…' },
                                    ...transitions.map((s) => ({ value: s, label: s })),
                                  ]}
                                />
                              </div>
                            )}
                            <button
                              onClick={() => handleDelete(po)}
                              disabled={
                                isPending ||
                                (po.status !== 'Draft' && po.status !== 'Cancelled')
                              }
                              title={
                                po.status !== 'Draft' && po.status !== 'Cancelled'
                                  ? 'Only Draft / Cancelled POs can be deleted'
                                  : 'Delete'
                              }
                              className="p-1.5 rounded hover:bg-danger/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 size={14} className="text-danger" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-bg/30 border-t border-border/40">
                          <td colSpan={9} className="px-4 py-3">
                            <div className="ml-7">
                              <div className="text-xs uppercase tracking-wider text-muted font-semibold mb-2">
                                Line Items
                              </div>
                              <table className="w-full text-xs">
                                <thead className="text-muted">
                                  <tr>
                                    <th className="text-left py-1 font-medium">Item</th>
                                    <th className="text-right py-1 font-medium">Qty</th>
                                    <th className="text-right py-1 font-medium">Unit Rate</th>
                                    <th className="text-right py-1 font-medium">Line Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {po.purchase_order_lines.map((line) => (
                                    <tr key={line.id} className="border-t border-border/30">
                                      <td className="py-1.5">{line.items?.name ?? '—'}</td>
                                      <td className="py-1.5 text-right">
                                        {Number(line.quantity).toFixed(2)} {line.items?.unit}
                                      </td>
                                      <td className="py-1.5 text-right text-muted">
                                        {formatCurrency(Number(line.unit_rate))}
                                      </td>
                                      <td className="py-1.5 text-right font-medium">
                                        {formatCurrency(Number(line.line_total))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {po.notes && (
                                <div className="mt-3 pt-3 border-t border-border/30 text-xs text-muted">
                                  <strong className="text-text">Notes:</strong> {po.notes}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Purchase Order" size="lg">
        {modalOpen && (
          <PurchaseOrderForm
            itemOptions={itemOptions}
            seedSuggestions={seedFromSuggestions ? suggestions : []}
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

function StatusBadge({ status }: { status: PoStatus }) {
  const map: Record<PoStatus, string> = {
    Draft:                 'bg-border/40 text-muted',
    Sent:                  'bg-info/15 text-info',
    'Partially Received':  'bg-accent/15 text-accent',
    Received:              'bg-success/15 text-success',
    Cancelled:             'bg-danger/15 text-danger',
  };
  return (
    <span className={cn('inline-block px-2 py-0.5 rounded-md text-xs font-semibold', map[status])}>
      {status}
    </span>
  );
}
