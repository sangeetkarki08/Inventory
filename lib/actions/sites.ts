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

const siteSchema = z.object({
  name: z.string().trim().min(1, 'Site name is required').max(120),
  type: z.enum(['Main Store', 'Site', 'Subcontractor', 'Individual']),
  project_id: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : Number(v)))
    .refine((v) => v == null || (Number.isInteger(v) && v > 0), 'Invalid project'),
  description: optStr(1000),
});

// ─── Result type ────────────────────────────────────────────────────────────
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
export async function createSite(formData: FormData): Promise<ActionResult<{ id: number }>> {
  const parsed = siteSchema.safeParse({
    name:        formData.get('name'),
    type:        formData.get('type'),
    project_id:  formData.get('project_id'),
    description: formData.get('description'),
  });
  if (!parsed.success) return fromZod(parsed.error) as ActionResult<{ id: number }>;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sites')
    .insert({
      name:        parsed.data.name,
      type:        parsed.data.type,
      project_id:  parsed.data.project_id,
      description: parsed.data.description,
    })
    .select('id')
    .single();

  if (error) {
    const friendly = error.code === '23505'
      ? 'A site with this name already exists for this project.'
      : error.message;
    return { ok: false, error: friendly };
  }
  revalidatePath('/sites');
  return { ok: true, data: { id: data.id as number } };
}

export async function updateSite(id: number, formData: FormData): Promise<ActionResult> {
  const parsed = siteSchema.safeParse({
    name:        formData.get('name'),
    type:        formData.get('type'),
    project_id:  formData.get('project_id'),
    description: formData.get('description'),
  });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from('sites')
    .update({
      name:        parsed.data.name,
      type:        parsed.data.type,
      project_id:  parsed.data.project_id,
      description: parsed.data.description,
    })
    .eq('id', id);

  if (error) {
    const friendly = error.code === '23505'
      ? 'A site with this name already exists for this project.'
      : error.message;
    return { ok: false, error: friendly };
  }
  revalidatePath('/sites');
  return { ok: true, data: undefined };
}

export async function deleteSite(id: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('sites').delete().eq('id', id);
  if (error) {
    const friendly = error.code === '23503'
      ? 'Cannot delete: this site has equipment or stock movements linked to it.'
      : error.message;
    return { ok: false, error: friendly };
  }
  revalidatePath('/sites');
  return { ok: true, data: undefined };
}
