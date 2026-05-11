'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// ─── Schema ─────────────────────────────────────────────────────────────────
const optStr = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : v));

const stockOutSchema = z.object({
  item_id: z
    .string()
    .min(1, 'Select an item')
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0, 'Invalid item'),
  site_id: z
    .string()
    .min(1, 'Select a site')
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0, 'Invalid site'),
  issue_type: z.enum(['Consumption', 'Transfer', 'Tool Issue', 'Return']),
  issued_at:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  quantity: z
    .string()
    .min(1, 'Required')
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v) && v > 0, 'Must be greater than 0'),
  description: optStr(500),
});

// Result types — discriminated so the form knows which error path to render.
type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; kind?: 'insufficient' | 'validation' | 'unknown' };

interface FifoBatchBreakdown {
  stock_in_id: number;
  quantity: number;
  unit_rate: number;
}

interface ProcessStockOutResult {
  stock_out_id: number;
  total_cost: number;
  breakdown: FifoBatchBreakdown[];
}

function fromZod(err: z.ZodError): ActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.');
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, error: 'Validation failed', fieldErrors, kind: 'validation' };
}

// ═══════════════════════════════════════════════════════════════════════════
/**
 * Issues stock via the process_stock_out RPC. The RPC:
 *   - Locks all in-stock batches for the item (FOR UPDATE)
 *   - Iterates oldest-first
 *   - Decrements remaining_quantity per batch
 *   - Records the breakdown in stock_out_batches
 *   - Computes total cost weighted across batches
 *
 * Returns the breakdown so the UI can show "this issue cost X across batches A, B, C".
 */
export async function createStockOut(
  formData: FormData,
): Promise<ActionResult<ProcessStockOutResult>> {
  const parsed = stockOutSchema.safeParse({
    item_id:     formData.get('item_id'),
    site_id:     formData.get('site_id'),
    issue_type:  formData.get('issue_type'),
    issued_at:   formData.get('issued_at'),
    quantity:    formData.get('quantity'),
    description: formData.get('description'),
  });
  if (!parsed.success) {
    return fromZod(parsed.error) as ActionResult<ProcessStockOutResult>;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('process_stock_out', {
    p_item_id:     parsed.data.item_id,
    p_quantity:    parsed.data.quantity,
    p_site_id:     parsed.data.site_id,
    p_issue_type:  parsed.data.issue_type,
    p_issued_at:   parsed.data.issued_at,
    p_description: parsed.data.description,
  });

  if (error) {
    // Map Postgres error codes to user-friendly messages.
    if (error.code === 'P0001') {
      // Insufficient stock — the RPC raised this.
      return { ok: false, error: error.message, kind: 'insufficient' };
    }
    if (error.code === '40001') {
      return {
        ok: false,
        error: 'Stock changed during the transaction. Please retry.',
        kind: 'unknown',
      };
    }
    return { ok: false, error: error.message, kind: 'unknown' };
  }

  if (!data) {
    return { ok: false, error: 'Stock-out RPC returned no data', kind: 'unknown' };
  }

  // Cast: data shape is jsonb, runtime structure matches our interface.
  const result = data as unknown as ProcessStockOutResult;

  // FIFO consumed batches → dashboard, items, stock-in all need refresh.
  revalidatePath('/stock-out');
  revalidatePath('/stock-in');
  revalidatePath('/dashboard');
  revalidatePath('/items');

  return { ok: true, data: result };
}

export async function deleteStockOut(_id: number): Promise<ActionResult> {
  // Stock-out reversals are intentionally not exposed — they would require
  // putting consumed quantities back onto specific FIFO batches, which is
  // ambiguous (which batch? at what rate?). This needs a deliberate "stock
  // adjustment" workflow rather than a delete. Leaving stub for future.
  return {
    ok: false,
    error:
      'Stock-out records cannot be deleted. To correct an error, record a Return issue-type in the opposite direction.',
  };
}
