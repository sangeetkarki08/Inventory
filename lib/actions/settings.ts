'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

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

// ─── Helper: ensure caller is Admin ─────────────────────────────────────────
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Not authenticated' };

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return { ok: false as const, error: 'Could not verify role' };
  }
  if (profile.role !== 'Admin') {
    return { ok: false as const, error: 'Only Admins can perform this action' };
  }
  return { ok: true as const, supabase, user };
}

// ═══════════════════════════════════════════════════════════════════════════
//  VAT Rate
// ═══════════════════════════════════════════════════════════════════════════
const vatSchema = z.object({
  vat_rate: z
    .string()
    .min(1, 'VAT rate is required')
    .transform((v) => Number(v))
    .refine(
      (v) => Number.isFinite(v) && v >= 0 && v <= 100,
      'VAT rate must be between 0 and 100',
    ),
});

export async function updateVatRate(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = vatSchema.safeParse({
    vat_rate: formData.get('vat_rate'),
  });
  if (!parsed.success) return fromZod(parsed.error);

  // app_settings.value is JSONB. We store the numeric VAT rate as a JSON number.
  const { error } = await auth.supabase
    .from('app_settings')
    .upsert(
      { key: 'vat_rate', value: parsed.data.vat_rate, updated_by: auth.user.id },
      { onConflict: 'key' },
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings');
  revalidatePath('/stock-in'); // Stock IN form reads this default.
  return { ok: true, data: undefined };
}

// ═══════════════════════════════════════════════════════════════════════════
//  User Roles
// ═══════════════════════════════════════════════════════════════════════════
const roleSchema = z.object({
  user_id: z.string().min(1),
  role: z.enum(['Admin', 'Store Manager']),
});

export async function updateUserRole(
  userId: string,
  role: 'Admin' | 'Store Manager',
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = roleSchema.safeParse({ user_id: userId, role });
  if (!parsed.success) return fromZod(parsed.error);

  // Don't let an admin demote themselves — they'd lock themselves out of admin
  // controls. They can demote *another* admin if there's at least two of them.
  if (parsed.data.user_id === auth.user.id && parsed.data.role !== 'Admin') {
    return {
      ok: false,
      error: 'You cannot demote yourself. Ask another Admin to do it.',
    };
  }

  // If demoting an admin, make sure there's at least one other admin.
  if (parsed.data.role === 'Store Manager') {
    const { count, error: countErr } = await auth.supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'Admin');
    if (countErr) return { ok: false, error: countErr.message };
    if ((count ?? 0) <= 1) {
      return {
        ok: false,
        error:
          'Cannot demote the last remaining Admin. Promote someone else to Admin first.',
      };
    }
  }

  const { error } = await auth.supabase
    .from('profiles')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.user_id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings');
  return { ok: true, data: undefined };
}

export async function toggleUserActive(
  userId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (userId === auth.user.id && !isActive) {
    return { ok: false, error: 'You cannot deactivate yourself.' };
  }

  const { error } = await auth.supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings');
  return { ok: true, data: undefined };
}
