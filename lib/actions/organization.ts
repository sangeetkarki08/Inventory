'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// ─── Schemas ────────────────────────────────────────────────────────────────
// Use a small helper that converts '' → null for optional text fields so
// Postgres stores NULL instead of empty strings.
const optStr = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : v));

const companySchema = z.object({
  name:          z.string().trim().min(1, 'Company name is required').max(120),
  address:       optStr(500),
  contact_email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : v))
    .refine((v) => v == null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Invalid email'),
  contact_phone: optStr(40),
  notes:         optStr(1000),
});

const projectSchema = z
  .object({
    company_id:  z.coerce.number().int().positive('Select a company'),
    name:        z.string().trim().min(1, 'Project name is required').max(120),
    status:      z.enum(['Active', 'On Hold', 'Completed', 'Cancelled']),
    start_date:  optStr(10),
    end_date:    optStr(10),
    description: optStr(1000),
  })
  .refine(
    (d) => !d.start_date || !d.end_date || d.end_date >= d.start_date,
    { message: 'End date must be on or after start date', path: ['end_date'] },
  );

// ─── Result helper (NOT exported — 'use server' allows only async exports) ──
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

// ═══════════════════════════════════════════════════════════════════ COMPANIES
export async function createCompany(formData: FormData): Promise<ActionResult<{ id: number }>> {
  const parsed = companySchema.safeParse({
    name:          formData.get('name'),
    address:       formData.get('address'),
    contact_email: formData.get('contact_email'),
    contact_phone: formData.get('contact_phone'),
    notes:         formData.get('notes'),
  });
  if (!parsed.success) return fromZod(parsed.error) as ActionResult<{ id: number }>;

  const supabase = await createClient();

  // Build a concrete object literal here so Supabase's overload resolver can
  // match it against the generated Insert type. Don't pass through a generic
  // helper — that erases enough specificity to make .insert() collapse to never.
  const { data, error } = await supabase
    .from('companies')
    .insert({
      name:          parsed.data.name,
      address:       parsed.data.address,
      contact_email: parsed.data.contact_email,
      contact_phone: parsed.data.contact_phone,
      notes:         parsed.data.notes,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/companies');
  return { ok: true, data: { id: data.id as number } };
}

export async function updateCompany(
  id: number,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = companySchema.safeParse({
    name:          formData.get('name'),
    address:       formData.get('address'),
    contact_email: formData.get('contact_email'),
    contact_phone: formData.get('contact_phone'),
    notes:         formData.get('notes'),
  });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from('companies')
    .update({
      name:          parsed.data.name,
      address:       parsed.data.address,
      contact_email: parsed.data.contact_email,
      contact_phone: parsed.data.contact_phone,
      notes:         parsed.data.notes,
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/companies');
  return { ok: true, data: undefined };
}

export async function deleteCompany(id: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('companies').delete().eq('id', id);
  if (error) {
    const friendly = error.code === '23503'
      ? 'Cannot delete: this company still has projects. Delete the projects first.'
      : error.message;
    return { ok: false, error: friendly };
  }
  revalidatePath('/companies');
  return { ok: true, data: undefined };
}

// ═══════════════════════════════════════════════════════════════════ PROJECTS
export async function createProject(formData: FormData): Promise<ActionResult<{ id: number }>> {
  const parsed = projectSchema.safeParse({
    company_id:  formData.get('company_id'),
    name:        formData.get('name'),
    status:      formData.get('status'),
    start_date:  formData.get('start_date'),
    end_date:    formData.get('end_date'),
    description: formData.get('description'),
  });
  if (!parsed.success) return fromZod(parsed.error) as ActionResult<{ id: number }>;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .insert({
      company_id:  parsed.data.company_id,
      name:        parsed.data.name,
      status:      parsed.data.status,
      start_date:  parsed.data.start_date,
      end_date:    parsed.data.end_date,
      description: parsed.data.description,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/companies');
  return { ok: true, data: { id: data.id as number } };
}

export async function updateProject(
  id: number,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = projectSchema.safeParse({
    company_id:  formData.get('company_id'),
    name:        formData.get('name'),
    status:      formData.get('status'),
    start_date:  formData.get('start_date'),
    end_date:    formData.get('end_date'),
    description: formData.get('description'),
  });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from('projects')
    .update({
      company_id:  parsed.data.company_id,
      name:        parsed.data.name,
      status:      parsed.data.status,
      start_date:  parsed.data.start_date,
      end_date:    parsed.data.end_date,
      description: parsed.data.description,
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/companies');
  return { ok: true, data: undefined };
}

export async function deleteProject(id: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) {
    const friendly = error.code === '23503'
      ? 'Cannot delete: this project has sites or stock records linked to it.'
      : error.message;
    return { ok: false, error: friendly };
  }
  revalidatePath('/companies');
  return { ok: true, data: undefined };
}
