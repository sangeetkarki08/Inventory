// =============================================================================
//  lib/services/stock-out.service.ts
// =============================================================================
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase.generated';
import type {
  ItemId,
  ProcessStockOutResult,
  FifoBatchBreakdown,
  StockOutId,
  StockInId,
} from '@/types/database.types';

// ─── Errors ──────────────────────────────────────────────────────────────────
export class StockOutError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'StockOutError';
  }
}

export class InsufficientStockError extends StockOutError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'InsufficientStockError';
  }
}

export class StockOutValidationError extends StockOutError {
  constructor(public readonly issues: z.ZodIssue[]) {
    super('Validation failed for stock-out request');
    this.name = 'StockOutValidationError';
  }
}

const ISSUE_TYPES = ['Consumption', 'Transfer', 'Tool Issue', 'Return'] as const;

export const processStockOutSchema = z.object({
  itemId:      z.number().int().positive(),
  quantity:    z.number().positive().finite(),
  siteId:      z.number().int().positive(),
  issueType:   z.enum(ISSUE_TYPES),
  issuedAt:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().max(500).optional().nullable(),
});

export type ProcessStockOutInput = z.infer<typeof processStockOutSchema>;

const breakdownSchema = z.object({
  stock_in_id: z.number().int().positive(),
  quantity:    z.number().positive(),
  unit_rate:   z.number().nonnegative(),
});

const resultSchema = z.object({
  stock_out_id: z.number().int().positive(),
  total_cost:   z.number().nonnegative(),
  breakdown:    z.array(breakdownSchema),
});

function mapRpcError(error: { code?: string; message: string }): StockOutError {
  switch (error.code) {
    case 'P0001': return new InsufficientStockError(error.message, error);
    case '22023': return new StockOutError(`Invalid input: ${error.message}`, error);
    case '23503': return new StockOutError(`Reference not found: ${error.message}`, error);
    case '40001': return new StockOutError('Stock changed during transaction. Please retry.', error);
    default:      return new StockOutError(error.message, error);
  }
}

export async function processStockOut(
  supabase: SupabaseClient<Database>,
  input: ProcessStockOutInput,
): Promise<ProcessStockOutResult> {
  const parsed = processStockOutSchema.safeParse(input);
  if (!parsed.success) throw new StockOutValidationError(parsed.error.issues);

  const { data, error } = await supabase.rpc('process_stock_out', {
    p_item_id:     parsed.data.itemId,
    p_quantity:    parsed.data.quantity,
    p_site_id:     parsed.data.siteId,
    p_issue_type:  parsed.data.issueType,
    p_issued_at:   parsed.data.issuedAt,
    p_description: parsed.data.description ?? null,
  });

  if (error) throw mapRpcError(error);
  if (data === null) throw new StockOutError('RPC returned no payload');

  const validated = resultSchema.safeParse(data);
  if (!validated.success) {
    throw new StockOutError('Unexpected RPC response shape', validated.error.issues);
  }

  return {
    stock_out_id: validated.data.stock_out_id as StockOutId,
    total_cost:   validated.data.total_cost,
    breakdown:    validated.data.breakdown.map<FifoBatchBreakdown>((b) => ({
      stock_in_id: b.stock_in_id as StockInId,
      quantity:    b.quantity,
      unit_rate:   b.unit_rate,
    })),
  };
}

export async function getItemStock(
  supabase: SupabaseClient<Database>,
  itemId: ItemId,
) {
  const { data, error } = await supabase
    .from('v_item_stock')
    .select('*')
    .eq('item_id', itemId as unknown as number)
    .single();
  if (error) throw new StockOutError(error.message, error);
  return data;
}

export async function getItemFifoBatches(
  supabase: SupabaseClient<Database>,
  itemId: ItemId,
) {
  const { data, error } = await supabase
    .from('stock_in')
    .select('id, received_at, quantity, remaining_quantity, unit_rate, supplier')
    .eq('item_id', itemId as unknown as number)
    .gt('remaining_quantity', 0)
    .order('received_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw new StockOutError(error.message, error);
  return data;
}
