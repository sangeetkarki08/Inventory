'use client';

import { useState, useTransition } from 'react';
import { Input, Textarea, Select, Button } from '@/components/ui/form';
import { createStockOut } from '@/lib/actions/stock-out';
import { formatCurrency, cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

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

interface FifoBatchBreakdown {
  stock_in_id: number;
  quantity: number;
  unit_rate: number;
}

interface SuccessResult {
  stock_out_id: number;
  total_cost: number;
  breakdown: FifoBatchBreakdown[];
}

const ISSUE_TYPE_OPTIONS = [
  { value: 'Consumption', label: 'Consumption (used up)' },
  { value: 'Transfer',    label: 'Transfer (moved to another site)' },
  { value: 'Tool Issue',  label: 'Tool Issue (assigned to person)' },
  { value: 'Return',      label: 'Return (sent back)' },
];

export function StockOutForm({
  items,
  sites,
  onDone,
}: {
  items: ItemWithStock[];
  sites: SiteOption[];
  onDone: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [insufficient, setInsufficient] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Live state for the availability check + item context.
  const [itemId, setItemId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');

  // Once submitted successfully, we show the FIFO breakdown instead of the form.
  const [success, setSuccess] = useState<SuccessResult | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const selectedItem = items.find((i) => String(i.id) === itemId);
  const requestedQty = Number(quantity);
  const isAvailable = selectedItem ? selectedItem.available > 0 : true;
  const isOverdraft = selectedItem != null
    && Number.isFinite(requestedQty)
    && requestedQty > selectedItem.available;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);
    setInsufficient(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await createStockOut(formData);
      if (!res.ok) {
        if (res.kind === 'insufficient') {
          setInsufficient(res.error);
        } else if (res.fieldErrors) {
          setErrors(res.fieldErrors);
        } else {
          setSubmitError(res.error);
        }
        return;
      }
      setSuccess(res.data);
    });
  }

  // ── Success state: show the FIFO breakdown ────────────────────────────
  if (success) {
    return (
      <div className="space-y-4">
        <div className="text-center py-4">
          <CheckCircle2 className="mx-auto mb-2 text-success" size={40} />
          <h3 className="text-lg font-bold">Stock issued successfully</h3>
          <p className="text-sm text-muted mt-1">
            FIFO consumed {success.breakdown.length}{' '}
            batch{success.breakdown.length === 1 ? '' : 'es'}
          </p>
        </div>

        <div className="bg-bg border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider text-muted font-semibold">
              FIFO Cost Breakdown
            </div>
            <div className="text-xs text-muted">Oldest batch consumed first</div>
          </div>

          <div className="space-y-2">
            {success.breakdown.map((b, idx) => (
              <div
                key={b.stock_in_id}
                className="flex items-center justify-between gap-3 text-sm py-2 px-3 bg-panel rounded-lg border border-border/50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted bg-bg/50 px-1.5 py-0.5 rounded">
                    #{idx + 1}
                  </span>
                  <span className="text-muted">Batch ID</span>
                  <span className="font-mono">{b.stock_in_id}</span>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <span>{Number(b.quantity).toFixed(2)}</span>
                  <span className="text-xs">×</span>
                  <span>{formatCurrency(Number(b.unit_rate))}</span>
                  <ArrowRight size={12} />
                  <span className="font-medium text-text">
                    {formatCurrency(Number(b.quantity) * Number(b.unit_rate))}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border mt-3 pt-3 flex items-center justify-between">
            <span className="font-semibold">Total Issue Cost</span>
            <span className="font-bold text-success text-lg">
              {formatCurrency(success.total_cost)}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={onDone}>Close</Button>
        </div>
      </div>
    );
  }

  // ── Form state ────────────────────────────────────────────────────────
  const itemOptions = [
    { value: '', label: '— Select item —' },
    ...items.map((i) => ({
      value: String(i.id),
      label: `${i.name}  ·  ${i.available.toFixed(2)} ${i.unit} available`,
    })),
  ];

  const siteOptions = [
    { value: '', label: '— Select destination site —' },
    ...sites.map((s) => ({
      value: String(s.id),
      label: `${s.name} (${s.type})`,
    })),
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr,180px] gap-4">
        <Select
          name="item_id"
          label="Item"
          options={itemOptions}
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          error={errors.item_id}
          required
        />
        <Input
          name="issued_at"
          type="date"
          label="Issued On"
          defaultValue={today}
          error={errors.issued_at}
          required
        />
      </div>

      {selectedItem && (
        <div
          className={cn(
            'rounded-lg p-3 text-sm flex items-center gap-3',
            isAvailable
              ? 'bg-info/5 border border-info/30 text-info'
              : 'bg-danger/10 border border-danger/30 text-danger',
          )}
        >
          {isAvailable ? (
            <>
              <CheckCircle2 size={16} />
              <span>
                <strong>{selectedItem.available.toFixed(2)} {selectedItem.unit}</strong> currently
                in stock for <strong>{selectedItem.name}</strong>
              </span>
            </>
          ) : (
            <>
              <AlertTriangle size={16} />
              <span>
                <strong>{selectedItem.name}</strong> has zero stock — record receipts via Stock IN first.
              </span>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Input
            name="quantity"
            type="number"
            step="0.001"
            min="0"
            label={`Quantity to Issue ${selectedItem ? `(${selectedItem.unit})` : ''}`}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            error={errors.quantity}
            required
            placeholder="0"
          />
          {isOverdraft && (
            <p className="mt-1 text-xs text-danger">
              ⚠ Exceeds available stock ({selectedItem!.available.toFixed(2)} {selectedItem!.unit})
            </p>
          )}
        </div>
        <Select
          name="issue_type"
          label="Issue Type"
          options={ISSUE_TYPE_OPTIONS}
          defaultValue="Consumption"
          error={errors.issue_type}
          required
        />
      </div>

      <Select
        name="site_id"
        label="Destination Site"
        options={siteOptions}
        error={errors.site_id}
        required
      />

      <Textarea
        name="description"
        label="Description / Reference"
        error={errors.description}
        placeholder="Issue slip number, person name, purpose, etc."
      />

      {insufficient && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{insufficient}</span>
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
        <Button
          type="submit"
          loading={isPending}
          disabled={!selectedItem || !isAvailable || isOverdraft}
        >
          Issue Stock
        </Button>
      </div>
    </form>
  );
}
