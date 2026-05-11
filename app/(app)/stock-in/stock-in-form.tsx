'use client';

import { useState, useTransition, useMemo } from 'react';
import { Input, Textarea, Select, Button } from '@/components/ui/form';
import { createStockIn } from '@/lib/actions/stock-in';
import { formatCurrency } from '@/lib/utils';

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

export function StockInForm({
  items,
  projects,
  defaultVatRate,
  onDone,
}: {
  items: ItemOption[];
  projects: ProjectOption[];
  defaultVatRate: number;
  onDone: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Live form state for the VAT calculation preview.
  const [itemId,   setItemId]   = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [unitRate, setUnitRate] = useState<string>('');
  const [vatRate,  setVatRate]  = useState<string>(String(defaultVatRate));

  const today = new Date().toISOString().slice(0, 10);

  // Live VAT calculation: Base + Base × VAT% = Total
  // Computed every render so the preview updates as you type.
  const calc = useMemo(() => {
    const q = Number(quantity);
    const r = Number(unitRate);
    const v = Number(vatRate);
    if (!Number.isFinite(q) || !Number.isFinite(r) || !Number.isFinite(v)) {
      return { base: 0, vat: 0, total: 0, valid: false };
    }
    const base  = q * r;
    const vat   = base * (v / 100);
    const total = base + vat;
    return { base, vat, total, valid: q > 0 && r >= 0 && v >= 0 };
  }, [quantity, unitRate, vatRate]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await createStockIn(formData);
      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        else setSubmitError(res.error);
        return;
      }
      onDone();
    });
  }

  const itemOptions = [
    { value: '', label: '— Select item —' },
    ...items.map((i) => ({
      value: String(i.id),
      label: `${i.name} (${i.category}, ${i.unit})`,
    })),
  ];

  const projectOptions = [
    { value: '', label: '— No project (general stock) —' },
    ...projects.map((p) => ({ value: String(p.id), label: p.name })),
  ];

  // Find the selected item's unit for display.
  const selectedItem = items.find((i) => String(i.id) === itemId);

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
          name="received_at"
          type="date"
          label="Received On"
          defaultValue={today}
          error={errors.received_at}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          name="quantity"
          type="number"
          step="0.001"
          min="0"
          label={`Quantity ${selectedItem ? `(${selectedItem.unit})` : ''}`}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          error={errors.quantity}
          required
          placeholder="0"
        />
        <Input
          name="unit_rate"
          type="number"
          step="0.01"
          min="0"
          label="Unit Rate"
          value={unitRate}
          onChange={(e) => setUnitRate(e.target.value)}
          error={errors.unit_rate}
          required
          placeholder="0.00"
        />
        <Input
          name="vat_rate"
          type="number"
          step="0.1"
          min="0"
          max="100"
          label="VAT %"
          value={vatRate}
          onChange={(e) => setVatRate(e.target.value)}
          error={errors.vat_rate}
          required
        />
      </div>

      {/* ─── Live VAT calculation preview ─────────────────────────────── */}
      <div className="bg-bg border border-border rounded-xl p-4">
        <div className="text-xs uppercase tracking-wider text-muted mb-3 font-semibold">
          Cost Calculation
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted mb-1">Base Amount</div>
            <div className="font-semibold">
              {calc.valid ? formatCurrency(calc.base) : '—'}
            </div>
            <div className="text-[10px] text-muted mt-0.5">qty × rate</div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">VAT</div>
            <div className="font-semibold text-accent">
              {calc.valid ? formatCurrency(calc.vat) : '—'}
            </div>
            <div className="text-[10px] text-muted mt-0.5">
              base × {vatRate || 0}%
            </div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Total</div>
            <div className="font-bold text-success text-lg">
              {calc.valid ? formatCurrency(calc.total) : '—'}
            </div>
            <div className="text-[10px] text-muted mt-0.5">base + VAT</div>
          </div>
        </div>
      </div>

      <Input
        name="supplier"
        label="Supplier"
        error={errors.supplier}
        placeholder="Optional — e.g., Himal Cement Pvt. Ltd."
      />

      <Select
        name="project_id"
        label="Linked Project"
        options={projectOptions}
        error={errors.project_id}
      />

      <Textarea
        name="description"
        label="Description / Reference"
        error={errors.description}
        placeholder="PO number, invoice number, delivery note, etc."
      />

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
          Record Stock IN
        </Button>
      </div>
    </form>
  );
}
