'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// ─── Schema ─────────────────────────────────────────────────────────────────
const optStr = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : v));

const numFromString = (allowZero = true) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? 0 : Number(v)))
    .refine(
      (v) => Number.isFinite(v) && (allowZero ? v >= 0 : v > 0),
      'Must be a non-negative number',
    );

const itemSchema = z
  .object({
    name: z.string().trim().min(1, 'Item name is required').max(120),
    category: z.enum(['Consumable', 'Tools', 'Equipment', 'Spare Parts']),
    unit: z.enum([
      'Nos','Pcs','Kg','Ltr','Mtr','Box','Set','Roll','Bag','Ton','Pair','Sheet','Cu.m','Sq.m',
    ]),
    reorder_level: numFromString(true),
    max_level:     numFromString(true),
    preferred_supplier: optStr(120),
    equipment_id: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v === '' || v == null ? null : Number(v)))
      .refine(
        (v) => v == null || (Number.isInteger(v) && v > 0),
        'Invalid equipment',
      ),
    description: optStr(1000),
    is_active: z
      .string()
      .optional()
      .nullable()
      .transform((v) => v !== 'false'), // Defaults to true unless explicitly 'false'
  })
  .refine((d) => d.max_level >= d.reorder_level, {
    message: 'Max level must be ≥ reorder level',
    path: ['max_level'],
  })
  // Mirror the DB CHECK constraint: equipment_id is only allowed for Spare Parts.
  .refine((d) => d.category === 'Spare Parts' || d.equipment_id == null, {
    message: 'Equipment can only be linked to Spare Parts items',
    path: ['equipment_id'],
  });

// ─── Result helper ──────────────────────────────────────────────────────────
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
export async function createItem(formData: FormData): Promise<ActionResult<{ id: number }>> {
  const parsed = itemSchema.safeParse({
    name:               formData.get('name'),
    category:           formData.get('category'),
    unit:               formData.get('unit'),
    reorder_level:      formData.get('reorder_level'),
    max_level:          formData.get('max_level'),
    preferred_supplier: formData.get('preferred_supplier'),
    equipment_id:       formData.get('equipment_id'),
    description:        formData.get('description'),
    is_active:          formData.get('is_active'),
  });
  if (!parsed.success) return fromZod(parsed.error) as ActionResult<{ id: number }>;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('items')
    .insert({
      name:               parsed.data.name,
      category:           parsed.data.category,
      unit:               parsed.data.unit,
      reorder_level:      parsed.data.reorder_level,
      max_level:          parsed.data.max_level,
      preferred_supplier: parsed.data.preferred_supplier,
      equipment_id:       parsed.data.equipment_id,
      description:        parsed.data.description,
      is_active:          parsed.data.is_active,
    })
    .select('id')
    .single();

  if (error) {
    const friendly =
      error.code === '23505'
        ? 'An item with this name already exists.'
        : error.code === '23514'
          ? 'Database constraint failed: equipment can only be linked to Spare Parts.'
          : error.message;
    return { ok: false, error: friendly };
  }
  revalidatePath('/items');
  return { ok: true, data: { id: data.id as number } };
}

export async function updateItem(
  id: number,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = itemSchema.safeParse({
    name:               formData.get('name'),
    category:           formData.get('category'),
    unit:               formData.get('unit'),
    reorder_level:      formData.get('reorder_level'),
    max_level:          formData.get('max_level'),
    preferred_supplier: formData.get('preferred_supplier'),
    equipment_id:       formData.get('equipment_id'),
    description:        formData.get('description'),
    is_active:          formData.get('is_active'),
  });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from('items')
    .update({
      name:               parsed.data.name,
      category:           parsed.data.category,
      unit:               parsed.data.unit,
      reorder_level:      parsed.data.reorder_level,
      max_level:          parsed.data.max_level,
      preferred_supplier: parsed.data.preferred_supplier,
      equipment_id:       parsed.data.equipment_id,
      description:        parsed.data.description,
      is_active:          parsed.data.is_active,
    })
    .eq('id', id);

  if (error) {
    const friendly =
      error.code === '23505'
        ? 'An item with this name already exists.'
        : error.code === '23514'
          ? 'Database constraint failed: equipment can only be linked to Spare Parts.'
          : error.message;
    return { ok: false, error: friendly };
  }
  revalidatePath('/items');
  return { ok: true, data: undefined };
}

export async function deleteItem(id: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) {
    const friendly =
      error.code === '23503'
        ? 'Cannot delete: this item has stock movements (in or out) recorded against it.'
        : error.message;
    return { ok: false, error: friendly };
  }
  revalidatePath('/items');
  return { ok: true, data: undefined };
}
