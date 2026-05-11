'use client';

import { useState, useTransition } from 'react';
import { Input, Textarea, Select, Button } from '@/components/ui/form';
import { createSite, updateSite } from '@/lib/actions/sites';

type SiteType = 'Main Store' | 'Site' | 'Subcontractor' | 'Individual';

interface SiteRow {
  id: number;
  name: string;
  type: SiteType;
  description: string | null;
  project_id: number | null;
}

interface ProjectOption {
  id: number;
  name: string;
  company_id: number;
}

const TYPE_OPTIONS: { value: SiteType; label: string }[] = [
  { value: 'Main Store',    label: 'Main Store (central warehouse)' },
  { value: 'Site',          label: 'Site (project location)' },
  { value: 'Subcontractor', label: 'Subcontractor' },
  { value: 'Individual',    label: 'Individual (person)' },
];

export function SiteForm({
  initial,
  projects,
  companyMap,
  onDone,
}: {
  initial: SiteRow | null;
  projects: ProjectOption[];
  companyMap: Record<number, string>;
  onDone: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<SiteType>(initial?.type ?? 'Site');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = initial
        ? await updateSite(initial.id, formData)
        : await createSite(formData);

      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        else setSubmitError(res.error);
        return;
      }
      onDone();
    });
  }

  // Project dropdown shows "company name → project name" for clarity.
  const projectOptions = [
    { value: '', label: '— No project (e.g., Main Store) —' },
    ...projects.map((p) => ({
      value: String(p.id),
      label: `${companyMap[p.company_id] ?? '?'} · ${p.name}`,
    })),
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        name="name"
        label="Site Name"
        defaultValue={initial?.name ?? ''}
        error={errors.name}
        required
        autoFocus
        placeholder="e.g., Central Warehouse, Tower A Site Office"
      />

      <Select
        name="type"
        label="Type"
        options={TYPE_OPTIONS}
        value={type}
        onChange={(e) => setType(e.target.value as SiteType)}
        error={errors.type}
        required
      />

      <Select
        name="project_id"
        label="Linked Project"
        options={projectOptions}
        defaultValue={initial?.project_id != null ? String(initial.project_id) : ''}
        error={errors.project_id}
      />
      <p className="text-xs text-muted -mt-2">
        Optional — required for project sites, leave empty for the central store.
      </p>

      <Textarea
        name="description"
        label="Description"
        defaultValue={initial?.description ?? ''}
        error={errors.description}
        placeholder="Address, custodian name, or any notes"
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
          {initial ? 'Save Changes' : 'Create Site'}
        </Button>
      </div>
    </form>
  );
}
