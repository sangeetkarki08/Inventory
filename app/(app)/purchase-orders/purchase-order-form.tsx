'use client';

import { useState, useTransition, useMemo } from 'react';
import { Input, Textarea, Select, Button } from '@/components/ui/form';
import { createPurchaseOrder } from '@/lib/actions/purchase-orders';
import { formatCurrency } from '@/lib/utils';
import { Plus, X, Sparkles } from 'lucide-react';

interface ItemOption {
  id: number;
  name: string;
  unit: string;
  preferred_supplier: string | null;
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

interface Line {
  // Local row id for React keys (separate from item_id which can change).
  uid: string;
  item_id: string;     // empty string while unselected
  quantity: string;
  unit_rate: string;
}

let _uidCounter = 0;
const nextUid = () => `line-${++_uidCounter}-${Date.now()}`;

export function PurchaseOrderForm({
  itemOptions,
  seedSuggestions,
  onDone,
}: {
  itemOptions: ItemOption[];
  seedSuggestions: ItemSuggestion[];
  onDone: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  // Header state.
  const [poNumber, setPoNumber]       = useState(`PO-${today.replace(/-/g, '')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`);
  const [supplier, setSupplier]       = useState(seedSuggestions[0]?.preferred_supplier ?? '');
  const [orderedAt, setOrderedAt]     = useState(today);
  const [expectedAt, setExpectedAt]   = useState('');
  const [notes, setNotes]             = useState('');

  // Lines state — initialize from seed suggestions if provided.
  const [lines, setLines] = useState<Line[]>(() => {
    if (seedSuggestions.length > 0) {
      return seedSuggestions.map((s) => ({
        uid:       nextUid(),
        item_id:   String(s.id),
        quantity:  s.shortage.toFixed(2),
        unit_rate: '',
      }));
    }
    return [{ uid: nextUid(), item_id: '', quantity: '', unit_rate: '' }];
  });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldError, setFieldError]   = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  // Live grand total.
  const total = useMemo(
    () =>
      lines.reduce((s, l) => {
        const q = Number(l.quantity);
        const r = Number(l.unit_rate);
        if (!Number.isFinite(q) || !Number.isFinite(r)) return s;
        return s + q * r;
      }, 0),
    [lines],
  );

  function addLine() {
    setLines((prev) => [
      ...prev,
      { uid: nextUid(), item_id: '', quantity: '', unit_rate: '' },
    ]);
  }

  function removeLine(uid: string) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.uid !== uid)));
  }

  function updateLine(uid: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setFieldError(null);

    // Client-side validation of lines.
    const cleanLines: { item_id: number; quantity: number; unit_rate: number }[] = [];
    for (const l of lines) {
      const itemId = Number(l.item_id);
      const qty    = Number(l.quantity);
      const rate   = Number(l.unit_rate);
      if (!l.item_id) {
        setFieldError('Every line must have an item selected.');
        return;
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        setFieldError('Every line must have a positive quantity.');
        return;
      }
      if (!Number.isFinite(rate) || rate < 0) {
        setFieldError('Unit rate must be a non-negative number.');
        return;
      }
      cleanLines.push({ item_id: itemId, quantity: qty, unit_rate: rate });
    }

    // Reject duplicate items in the same PO.
    const seen = new Set<number>();
    for (const l of cleanLines) {
      if (seen.has(l.item_id)) {
        setFieldError('The same item appears multiple times. Please consolidate.');
        return;
      }
      seen.add(l.item_id);
    }

    startTransition(async () => {
      const res = await createPurchaseOrder({
        po_number:   poNumber.trim(),
        supplier:    supplier.trim(),
        ordered_at:  orderedAt,
        expected_at: expectedAt || null,
        notes:       notes.trim() || null,
        lines:       cleanLines,
      });

      if (!res.ok) {
        setSubmitError(res.error);
        return;
      }
      onDone();
    });
  }

  const lineItemOptions = [
    { value: '', label: '— Select item —' },
    ...itemOptions.map((i) => ({ value: String(i.id), label: `${i.name} (${i.unit})` })),
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {seedSuggestions.length > 0 && (
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-sm flex items-start gap-2">
          <Sparkles size={16} className="text-accent shrink-0 mt-0.5" />
          <div>
            <strong className="text-accent">Auto-seeded from low-stock items.</strong>{' '}
            Suggested quantities = max level − current stock. Review and edit before sending.
          </div>
        </div>
      )}

      {/* Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="PO Number"
          value={poNumber}
          onChange={(e) => setPoNumber(e.target.value)}
          required
          placeholder="PO-20260505-001"
        />
        <Input
          label="Supplier"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          required
          placeholder="e.g., Himal Cement Pvt. Ltd."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          type="date"
          label="Ordered Date"
          value={orderedAt}
          onChange={(e) => setOrderedAt(e.target.value)}
          required
        />
        <Input
          type="date"
          label="Expected Delivery"
          value={expectedAt}
          onChange={(e) => setExpectedAt(e.target.value)}
        />
      </div>

      {/* Lines */}
      <div className="bg-bg border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wider text-muted font-semibold">
            Line Items
          </div>
          <Button type="button" variant="secondary" onClick={addLine}>
            <Plus size={14} /> Add Line
          </Button>
        </div>

        <div className="space-y-2">
          {lines.map((line, idx) => {
            const lineTotal =
              Number(line.quantity) * Number(line.unit_rate);
            const validTotal = Number.isFinite(lineTotal);
            return (
              <div
                key={line.uid}
                className="grid grid-cols-12 gap-2 items-start bg-panel border border-border/50 rounded-lg p-2"
              >
                <div className="col-span-12 sm:col-span-5">
                  <Select
                    options={lineItemOptions}
                    value={line.item_id}
                    onChange={(e) => updateLine(line.uid, { item_id: e.target.value })}
                    aria-label={`Item for line ${idx + 1}`}
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.uid, { quantity: e.target.value })}
                    placeholder="Qty"
                    aria-label={`Quantity for line ${idx + 1}`}
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.unit_rate}
                    onChange={(e) => updateLine(line.uid, { unit_rate: e.target.value })}
                    placeholder="Rate"
                    aria-label={`Unit rate for line ${idx + 1}`}
                  />
                </div>
                <div className="col-span-3 sm:col-span-2 text-right text-sm py-2 text-muted">
                  {validTotal && lineTotal > 0 ? formatCurrency(lineTotal) : '—'}
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeLine(line.uid)}
                    disabled={lines.length === 1}
                    title={lines.length === 1 ? 'At least one line required' : 'Remove line'}
                    className="p-2 rounded hover:bg-danger/10 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <X size={14} className="text-danger" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border mt-3 pt-3 flex items-center justify-between">
          <span className="text-sm text-muted">Grand Total</span>
          <span className="font-bold text-success text-lg">{formatCurrency(total)}</span>
        </div>
      </div>

      <Textarea
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Internal notes, delivery instructions, payment terms…"
      />

      {fieldError && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
          ⚠ {fieldError}
        </div>
      )}
      {submitError && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
          ⚠ {submitError}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          Create PO (as Draft)
        </Button>
      </div>
    </form>
  );
}
