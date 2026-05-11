'use client';

import { useState, useTransition } from 'react';
import { Input, Textarea, Select, Button } from '@/components/ui/form';
import { createEquipment, updateEquipment } from '@/lib/actions/equipment';

type EquipmentCategory =
  | 'Excavator'
  | 'Crane'
  | 'Bulldozer'
  | 'Concrete Mixer'
  | 'Vibrator'
  | 'Generator'
  | 'Compressor'
  | 'Water Pump'
  | 'Scaffold'
  | 'Bar Cutter'
  | 'Welding Machine'
  | 'Other';

type EquipmentStatus = 'Active' | 'Under Repair' | 'Idle' | 'Retired';

interface EquipmentRow {
  id: number;
  name: string;
  category: string;
  model: string | null;
  serial_no: string | null;
  status: EquipmentStatus;
  site_id: number | null;
  notes: string | null;
}

interface SiteOption {
  id: number;
  name: string;
  type: string;
}

const CATEGORY_OPTIONS: { value: EquipmentCategory; label: EquipmentCategory }[] = [
  { value: 'Excavator',       label: 'Excavator' },
  { value: 'Crane',           label: 'Crane' },
  { value: 'Bulldozer',       label: 'Bulldozer' },
  { value: 'Concrete Mixer',  label: 'Concrete Mixer' },
  { value: 'Vibrator',        label: 'Vibrator' },
  { value: 'Generator',       label: 'Generator' },
  { value: 'Compressor',      label: 'Compressor' },
  { value: 'Water Pump',      label: 'Water Pump' },
  { value: 'Scaffold',        label: 'Scaffold' },
  { value: 'Bar Cutter',      label: 'Bar Cutter' },
  { value: 'Welding Machine', label: 'Welding Machine' },
  { value: 'Other',           label: 'Other' },
];

const STATUS_OPTIONS: { value: EquipmentStatus; label: EquipmentStatus }[] = [
  { value: 'Active',       label: 'Active' },
  { value: 'Under Repair', label: 'Under Repair' },
  { value: 'Idle',         label: 'Idle' },
  { value: 'Retired',      label: 'Retired' },
];

export function EquipmentForm({
  initial,
  sites,
  onDone,
}: {
  initial: EquipmentRow | null;
  sites: SiteOption[];
  onDone: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = initial
        ? await updateEquipment(initial.id, formData)
        : await createEquipment(formData);

      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        else setSubmitError(res.error);
        return;
      }
      onDone();
    });
  }

  const siteOptions = [
    { value: '', label: '— Not assigned to a site —' },
    ...sites.map((s) => ({
      value: String(s.id),
      label: `${s.name} (${s.type})`,
    })),
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        name="name"
        label="Equipment Name"
        defaultValue={initial?.name ?? ''}
        error={errors.name}
        required
        autoFocus
        placeholder="e.g., Excavator-001, Generator-25kVA"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          name="category"
          label="Category"
          options={CATEGORY_OPTIONS}
          defaultValue={initial?.category ?? 'Excavator'}
          error={errors.category}
          required
        />
        <Select
          name="status"
          label="Status"
          options={STATUS_OPTIONS}
          defaultValue={initial?.status ?? 'Active'}
          error={errors.status}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          name="model"
          label="Model"
          defaultValue={initial?.model ?? ''}
          error={errors.model}
          placeholder="e.g., CAT 320D, Cummins X15"
        />
        <Input
          name="serial_no"
          label="Serial Number"
          defaultValue={initial?.serial_no ?? ''}
          error={errors.serial_no}
          placeholder="Unique across all equipment"
        />
      </div>

      <Select
        name="site_id"
        label="Current Location (Site)"
        options={siteOptions}
        defaultValue={initial?.site_id != null ? String(initial.site_id) : ''}
        error={errors.site_id}
      />

      <Textarea
        name="notes"
        label="Notes"
        defaultValue={initial?.notes ?? ''}
        error={errors.notes}
        placeholder="Maintenance history, condition notes, etc."
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
          {initial ? 'Save Changes' : 'Create Equipment'}
        </Button>
      </div>
    </form>
  );
}
