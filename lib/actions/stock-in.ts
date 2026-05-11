'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const optStr = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : v));

const numFromString = (positive = false) =>
  z
    .string()
    .min(1, 'Required')
    .transform((v) => Number(v))
    .refine(
      (v) => Number.isFinite(v) && (positive ? v > 0 : v >= 0),
      positive ? 'Must be greater than 0' : 'Must be non-negative',
    );

const stockInSchema = z.object({
  item_id: z
    .string()
    .min(1, 'Select an item')
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0, 'Invalid item'),
  received_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  quantity:  numFromString(true),
  unit_rate: numFromString(false),
  vat_rate:  numFromString(false).refine((v) => v <= 100, 'VAT cannot exceed 100%'),
  supplier:  optStr(120),
  description: optStr(500),
  project_id: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : Number(v)))
    .refine(
      (v) => v == null || (Number.isInteger(v) && v > 0),
      'Invalid project',
    ),
});

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fromZod(err: z.ZodError): ActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.');
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, error: 'Validation failed', fieldErrors };
}

// ═══════════════════════════════════════════════════════════════════════════
export async function createStockIn(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  const parsed = stockInSchema.safeParse({
    item_id:     formData.get('item_id'),
    received_at: formData.get('received_at'),
    quantity:    formData.get('quantity'),
    unit_rate:   formData.get('unit_rate'),
    vat_rate:    formData.get('vat_rate'),
    supplier:    formData.get('supplier'),
    description: formData.get('description'),
    project_id:  formData.get('project_id'),
  });
  if (!parsed.success) return fromZod(parsed.error) as ActionResult<{ id: number }>;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stock_in')
    .insert({
      item_id:     parsed.data.item_id,
      received_at: parsed.data.received_at,
      quantity:    parsed.data.quantity,
      unit_rate:   parsed.data.unit_rate,
      vat_rate:    parsed.data.vat_rate,
      supplier:    parsed.data.supplier,
      description: parsed.data.description,
      project_id:  parsed.data.project_id,
      // remaining_quantity defaulted server-side to quantity (via DB trigger).
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  // Stock changes affect the dashboard too.
  revalidatePath('/stock-in');
  revalidatePath('/dashboard');
  return { ok: true, data: { id: data.id as number } };
}

export async function deleteStockIn(id: number): Promise<ActionResult> {
  const supabase = await createClient();

  // Safety: don't allow deleting a batch that's already been partially consumed
  // by stock_out. We check by reading remaining_quantity vs quantity.
  const { data: batch, error: readErr } = await supabase
    .from('stock_in')
    .select('quantity, remaining_quantity')
    .eq('id', id)
    .single();

  if (readErr) return { ok: false, error: readErr.message };
  if (!batch)  return { ok: false, error: 'Batch not found' };

  if (Number(batch.remaining_quantity) < Number(batch.quantity)) {
    return {
      ok: false,
      error:
        'Cannot delete: some of this batch has already been issued. Stock OUT records reference it via FIFO.',
    };
  }

  const { error } = await supabase.from('stock_in').delete().eq('id', id);
  if (error) {
    const friendly =
      error.code === '23503'
        ? 'Cannot delete: this batch has been partially consumed by stock-out transactions.'
        : error.message;
    return { ok: false, error: friendly };
  }
  revalidatePath('/stock-in');
  revalidatePath('/dashboard');
  return { ok: true, data: undefined };
}
