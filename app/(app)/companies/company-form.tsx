'use client';

import { useState, useTransition } from 'react';
import { Input, Textarea, Button } from '@/components/ui/form';
import { createCompany, updateCompany } from '@/lib/actions/organization';
import type { CompanyRow } from '@/types/database.types';

export function CompanyForm({
  initial,
  onDone,
}: {
  initial: CompanyRow | null;
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
        ? await updateCompany(initial.id as number, formData)
        : await createCompany(formData);

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
      <Input
        name="name"
        label="Company Name"
        defaultValue={initial?.name ?? ''}
        error={errors.name}
        required
        autoFocus
      />
      <Input
        name="address"
        label="Address"
        defaultValue={initial?.address ?? ''}
        error={errors.address}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          name="contact_email"
          type="email"
          label="Contact Email"
          defaultValue={initial?.contact_email ?? ''}
          error={errors.contact_email}
        />
        <Input
          name="contact_phone"
          label="Contact Phone"
          defaultValue={initial?.contact_phone ?? ''}
          error={errors.contact_phone}
        />
      </div>
      <Textarea
        name="notes"
        label="Notes"
        defaultValue={initial?.notes ?? ''}
        error={errors.notes}
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
          {initial ? 'Save Changes' : 'Create Company'}
        </Button>
      </div>
    </form>
  );
}
