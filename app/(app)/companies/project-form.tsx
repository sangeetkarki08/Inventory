'use client';

import { useState, useTransition } from 'react';
import { Input, Textarea, Select, Button } from '@/components/ui/form';
import { createProject, updateProject } from '@/lib/actions/organization';
import type { ProjectRow, ProjectStatus } from '@/types/database.types';

const STATUS_OPTIONS: { value: ProjectStatus; label: ProjectStatus }[] = [
  { value: 'Active',    label: 'Active' },
  { value: 'On Hold',   label: 'On Hold' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

export function ProjectForm({
  companyId,
  initial,
  onDone,
}: {
  companyId: number;
  initial: ProjectRow | null;
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
        ? await updateProject(initial.id as number, formData)
        : await createProject(formData);

      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        else setSubmitError(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="company_id" value={initial?.company_id ?? companyId} />

      <Input
        name="name"
        label="Project Name"
        defaultValue={initial?.name ?? ''}
        error={errors.name}
        required
        autoFocus
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Select
          name="status"
          label="Status"
          options={STATUS_OPTIONS}
          defaultValue={initial?.status ?? 'Active'}
          error={errors.status}
          required
        />
        <Input
          name="start_date"
          type="date"
          label="Start Date"
          defaultValue={initial?.start_date ?? ''}
          error={errors.start_date}
        />
        <Input
          name="end_date"
          type="date"
          label="End Date"
          defaultValue={initial?.end_date ?? ''}
          error={errors.end_date}
        />
      </div>

      <Textarea
        name="description"
        label="Description"
        defaultValue={initial?.description ?? ''}
        error={errors.description}
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
          {initial ? 'Save Changes' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
}
