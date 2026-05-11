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

const equipmentSchema = z.object({
  name: z.string().trim().min(1, 'Equipment name is required').max(120),
  category: z.enum([
    'Excavator',
    'Crane',
    'Bulldozer',
    'Concrete Mixer',
    'Vibrator',
    'Generator',
    'Compressor',
    'Water Pump',
    'Scaffold',
    'Bar Cutter',
    'Welding Machine',
    'Other',
  ]),
  model:     optStr(120),
  serial_no: optStr(120),
  status:    z.enum(['Active', 'Under Repair', 'Idle', 'Retired']),
  site_id: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : Number(v)))
    .refine((v) => v == null || (Number.isInteger(v) && v > 0), 'Invalid site'),
  notes: optStr(1000),
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
export async function createEquipment(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  const parsed = equipmentSchema.safeParse({
    name:      formData.get('name'),
    category:  formData.get('category'),
    model:     formData.get('model'),
    serial_no: formData.get('serial_no'),
    status:    formData.get('status'),
    site_id:   formData.get('site_id'),
    notes:     formData.get('notes'),
  });
  if (!parsed.success) return fromZod(parsed.error) as ActionResult<{ id: number }>;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('equipment')
    .insert({
      name:      parsed.data.name,
      category:  parsed.data.category,
      model:     parsed.data.model,
      serial_no: parsed.data.serial_no,
      status:    parsed.data.status,
      site_id:   parsed.data.site_id,
      notes:     parsed.data.notes,
    })
    .select('id')
    .single();

  if (error) {
    const friendly =
      error.code === '23505'
        ? 'Equipment with this serial number already exists.'
        : error.message;
    return { ok: false, error: friendly };
  }
  revalidatePath('/equipment');
  return { ok: true, data: { id: data.id as number } };
}

export async function updateEquipment(
  id: number,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = equipmentSchema.safeParse({
    name:      formData.get('name'),
    category:  formData.get('category'),
    model:     formData.get('model'),
    serial_no: formData.get('serial_no'),
    status:    formData.get('status'),
    site_id:   formData.get('site_id'),
    notes:     formData.get('notes'),
  });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from('equipment')
    .update({
      name:      parsed.data.name,
      category:  parsed.data.category,
      model:     parsed.data.model,
      serial_no: parsed.data.serial_no,
      status:    parsed.data.status,
      site_id:   parsed.data.site_id,
      notes:     parsed.data.notes,
    })
    .eq('id', id);

  if (error) {
    const friendly =
      error.code === '23505'
        ? 'Equipment with this serial number already exists.'
        : error.message;
    return { ok: false, error: friendly };
  }
  revalidatePath('/equipment');
  return { ok: true, data: undefined };
}

export async function deleteEquipment(id: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('equipment').delete().eq('id', id);
  if (error) {
    const friendly =
      error.code === '23503'
        ? 'Cannot delete: this equipment has spare-part items linked to it. Reassign or delete those items first.'
        : error.message;
    return { ok: false, error: friendly };
  }
  revalidatePath('/equipment');
  return { ok: true, data: undefined };
}
