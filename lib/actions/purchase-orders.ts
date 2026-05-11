'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// ─── Schemas ────────────────────────────────────────────────────────────────
const optStr = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : v));

const lineSchema = z.object({
  item_id:   z.number().int().positive(),
  quantity:  z.number().positive(),
  unit_rate: z.number().nonnegative(),
});

const createPoSchema = z.object({
  po_number:   z.string().trim().min(1, 'PO number is required').max(60),
  supplier:    z.string().trim().min(1, 'Supplier is required').max(120),
  ordered_at:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  expected_at: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : v))
    .refine(
      (v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v),
      'Invalid expected date',
    ),
  notes: optStr(1000),
  lines: z.array(lineSchema).min(1, 'At least one line item is required'),
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
/**
 * Create a PO header + lines in a single logical operation. We don't have
 * cross-table transactions in the JS client, so we insert the header first,
 * then the lines, and roll back manually if line insertion fails.
 */
export async function createPurchaseOrder(input: {
  po_number: string;
  supplier: string;
  ordered_at: string;
  expected_at: string | null;
  notes: string | null;
  lines: { item_id: number; quantity: number; unit_rate: number }[];
}): Promise<ActionResult<{ id: number }>> {
  const parsed = createPoSchema.safeParse(input);
  if (!parsed.success) {
    return fromZod(parsed.error) as ActionResult<{ id: number }>;
  }

  const supabase = await createClient();

  const totalAmount = parsed.data.lines.reduce(
    (s, l) => s + l.quantity * l.unit_rate,
    0,
  );

  const { data: header, error: headerErr } = await supabase
    .from('purchase_orders')
    .insert({
      po_number:    parsed.data.po_number,
      supplier:     parsed.data.supplier,
      ordered_at:   parsed.data.ordered_at,
      expected_at:  parsed.data.expected_at,
      notes:        parsed.data.notes,
      status:       'Draft',
      total_amount: Math.round(totalAmount * 100) / 100,
    })
    .select('id')
    .single();

  if (headerErr) {
    const friendly =
      headerErr.code === '23505'
        ? `PO number "${parsed.data.po_number}" already exists.`
        : headerErr.message;
    return { ok: false, error: friendly };
  }

  const poId = header.id as number;

  const { error: linesErr } = await supabase
    .from('purchase_order_lines')
    .insert(
      parsed.data.lines.map((l) => ({
        purchase_order_id: poId,
        item_id:           l.item_id,
        quantity:          l.quantity,
        unit_rate:         l.unit_rate,
      })),
    );

  if (linesErr) {
    // Roll back the header so we don't leave an orphan PO.
    await supabase.from('purchase_orders').delete().eq('id', poId);
    return {
      ok: false,
      error: `Failed to add line items: ${linesErr.message}`,
    };
  }

  revalidatePath('/purchase-orders');
  return { ok: true, data: { id: poId } };
}

const PO_STATUSES = [
  'Draft',
  'Sent',
  'Partially Received',
  'Received',
  'Cancelled',
] as const;

export async function updatePoStatus(
  id: number,
  status: typeof PO_STATUSES[number],
): Promise<ActionResult> {
  if (!PO_STATUSES.includes(status)) {
    return { ok: false, error: 'Invalid status' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/purchase-orders');
  return { ok: true, data: undefined };
}

export async function deletePurchaseOrder(id: number): Promise<ActionResult> {
  const supabase = await createClient();

  // Only allow deletion of drafts. Sent / Received POs are records and
  // should be preserved or marked Cancelled instead.
  const { data: po, error: readErr } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('id', id)
    .single();

  if (readErr) return { ok: false, error: readErr.message };
  if (po && po.status !== 'Draft' && po.status !== 'Cancelled') {
    return {
      ok: false,
      error:
        'Only Draft or Cancelled POs can be deleted. Mark this PO as Cancelled instead.',
    };
  }

  const { error } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/purchase-orders');
  return { ok: true, data: undefined };
}
