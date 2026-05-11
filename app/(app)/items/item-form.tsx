'use client';

import { useState, useTransition } from 'react';
import { Input, Textarea, Select, Button } from '@/components/ui/form';
import { createItem, updateItem } from '@/lib/actions/items';
import { Wrench, CloudOff } from 'lucide-react';
import { offlineCreate, offlineUpdate, useSyncState } from '@/lib/offline';

type ItemCategory = 'Consumable' | 'Tools' | 'Equipment' | 'Spare Parts';
type ItemUnit =
  | 'Nos' | 'Pcs' | 'Kg' | 'Ltr' | 'Mtr' | 'Box' | 'Set'
  | 'Roll' | 'Bag' | 'Ton' | 'Pair' | 'Sheet' | 'Cu.m' | 'Sq.m';

interface ItemRow {
  id: number;
  name: string;
  category: ItemCategory;
  unit: string;
  reorder_level: number;
  max_level: number;
  preferred_supplier: string | null;
  equipment_id: number | null;
  description: string | null;
  is_active: boolean;
}

interface EquipmentOption {
  id: number;
  name: string;
  serial_no: string | null;
}

const CATEGORY_OPTIONS: { value: ItemCategory; label: string }[] = [
  { value: 'Consumable',  label: 'Consumable (cement, fuel, food, …)' },
  { value: 'Tools',       label: 'Tools (hammers, drills, …)' },
  { value: 'Equipment',   label: 'Equipment (heavy machinery)' },
  { value: 'Spare Parts', label: 'Spare Parts (linked to specific equipment)' },
];

const UNIT_OPTIONS: { value: ItemUnit; label: string }[] = [
  { value: 'Nos',  label: 'Nos'   }, { value: 'Pcs',  label: 'Pcs'  },
  { value: 'Kg',   label: 'Kg'    }, { value: 'Ltr',  label: 'Ltr'  },
  { value: 'Mtr',  label: 'Mtr'   }, { value: 'Box',  label: 'Box'  },
  { value: 'Set',  label: 'Set'   }, { value: 'Roll', label: 'Roll' },
  { value: 'Bag',  label: 'Bag'   }, { value: 'Ton',  label: 'Ton'  },
  { value: 'Pair', label: 'Pair'  }, { value: 'Sheet',label: 'Sheet'},
  { value: 'Cu.m', label: 'Cu.m'  }, { value: 'Sq.m', label: 'Sq.m' },
];

export function ItemForm({
  initial,
  equipment,
  onDone,
}: {
  initial: ItemRow | null;
  equipment: EquipmentOption[];
  onDone: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sync = useSyncState();

  // The category controls whether the equipment dropdown is shown.
  const [category, setCategory] = useState<ItemCategory>(
    initial?.category ?? 'Consumable',
  );

  function buildItemRow(fd: FormData): Record<string, unknown> {
    const eqId = fd.get('equipment_id');
    return {
      name: String(fd.get('name') ?? '').trim(),
      category: fd.get('category'),
      unit: fd.get('unit'),
      reorder_level: Number(fd.get('reorder_level') ?? 0),
      max_level: Number(fd.get('max_level') ?? 0),
      preferred_supplier: (fd.get('preferred_supplier') ?? '') || null,
      equipment_id: eqId ? Number(eqId) : null,
      description: (fd.get('description') ?? '') || null,
      is_active: fd.get('is_active') !== 'false',
    };
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);
    const formData = new FormData(e.currentTarget);

    // If category isn't Spare Parts, clear equipment_id explicitly so the DB
    // CHECK constraint isn't violated by stale form values.
    if (formData.get('category') !== 'Spare Parts') {
      formData.set('equipment_id', '');
    }

    startTransition(async () => {
      const res = initial
        ? await offlineUpdate(updateItem, initial.id, formData, {
            table: 'items',
            buildRow: buildItemRow,
          })
        : await offlineCreate(createItem, formData, {
            table: 'items',
            buildRow: buildItemRow,
          });

      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        else setSubmitError(res.error);
        return;
      }
      onDone();
    });
  }

  const equipmentOptions = [
    { value: '', label: '— Select equipment —' },
    ...equipment.map((e) => ({
      value: String(e.id),
      label: e.serial_no ? `${e.name} (${e.serial_no})` : e.name,
    })),
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!sync.isOnline && (
        <div className="bg-accent/10 border border-accent/30 rounded-lg px-3 py-2 text-xs text-accent flex items-center gap-2">
          <CloudOff size={14} />
          You're offline — this change will be saved locally and synced when you reconnect.
        </div>
      )}

      <Input
        name="name"
        label="Item Name"
        defaultValue={initial?.name ?? ''}
        error={errors.name}
        required
        autoFocus
        placeholder="e.g., Cement OPC 53 Grade, Hydraulic Filter, Welding Rods E6013"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          name="category"
          label="Category"
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={(e) => setCategory(e.target.value as ItemCategory)}
          error={errors.category}
          required
        />
        <Select
          name="unit"
          label="Unit"
          options={UNIT_OPTIONS}
          defaultValue={initial?.unit ?? 'Nos'}
          error={errors.unit}
          required
        />
      </div>

      {/* Conditional: only Spare Parts get an equipment link. */}
      {category === 'Spare Parts' && (
        <div className="bg-info/5 border border-info/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3 text-info text-sm font-medium">
            <Wrench size={14} />
            Spare Parts must link to specific equipment
          </div>
          <Select
            name="equipment_id"
            label="Linked Equipment"
            options={equipmentOptions}
            defaultValue={initial?.equipment_id != null ? String(initial.equipment_id) : ''}
            error={errors.equipment_id}
            required
          />
          {equipment.length === 0 && (
            <p className="text-xs text-amber-400 mt-2">
              ⚠ No equipment available. Go to the <strong>Equipment</strong> page first to add machinery,
              then come back to create spare-part items.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          name="reorder_level"
          type="number"
          step="0.01"
          min="0"
          label="Reorder Level"
          defaultValue={initial?.reorder_level != null ? String(initial.reorder_level) : '0'}
          error={errors.reorder_level}
          placeholder="0"
        />
        <Input
          name="max_level"
          type="number"
          step="0.01"
          min="0"
          label="Max Level"
          defaultValue={initial?.max_level != null ? String(initial.max_level) : '0'}
          error={errors.max_level}
          placeholder="0"
        />
      </div>
      <p className="text-xs text-muted -mt-2">
        Reorder level = trigger to buy more. Max level = upper inventory cap.
      </p>

      <Input
        name="preferred_supplier"
        label="Preferred Supplier"
        defaultValue={initial?.preferred_supplier ?? ''}
        error={errors.preferred_supplier}
        placeholder="Optional — e.g., Himal Cement Pvt. Ltd."
      />

      <Textarea
        name="description"
        label="Description"
        defaultValue={initial?.description ?? ''}
        error={errors.description}
        placeholder="Specifications, brand, grade, etc."
      />

      {/* Active toggle — defaults to true on create, preserves the existing value on edit. */}
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="hidden"
          name="is_active"
          value="true"
        />
        <input
          type="checkbox"
          defaultChecked={initial ? initial.is_active : true}
          onChange={(e) => {
            // Update the hidden input synchronously so FormData picks up 'true' or 'false'.
            const hidden = (e.target.parentElement!.querySelector(
              'input[type="hidden"][name="is_active"]',
            ) as HTMLInputElement | null);
            if (hidden) hidden.value = e.target.checked ? 'true' : 'false';
          }}
          className="rounded border-border bg-bg text-accent focus:ring-accent"
        />
        Active (uncheck to soft-disable this item without deleting)
      </label>

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
          {initial ? 'Save Changes' : 'Create Item'}
        </Button>
      </div>
    </form>
  );
}
