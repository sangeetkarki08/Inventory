import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SettingsView } from './settings-view';

export const dynamic = 'force-dynamic';

interface UserProfile {
  id: string;
  full_name: string;
  role: 'Admin' | 'Store Manager';
  is_active: boolean;
  created_at: string;
}

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch the caller's profile.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active, created_at')
    .eq('id', user.id)
    .single();

  // Fetch the VAT rate setting.
  const { data: vatSetting } = await supabase
    .from('app_settings')
    .select('value, updated_at')
    .eq('key', 'vat_rate')
    .single();

  let currentVatRate = 13;
  if (vatSetting && vatSetting.value != null) {
    const raw = vatSetting.value as unknown;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(n)) currentVatRate = n;
  }

  // Admins see the full user list. Store Managers see only themselves.
  const isAdmin = profile?.role === 'Admin';
  let allUsers: UserProfile[] = [];
  if (isAdmin) {
    const { data: users } = await supabase
      .from('profiles')
      .select('id, full_name, role, is_active, created_at')
      .order('role', { ascending: true })
      .order('full_name', { ascending: true });
    allUsers = (users ?? []) as unknown as UserProfile[];
  }

  return (
    <SettingsView
      currentUser={profile as unknown as UserProfile}
      userEmail={user.email ?? ''}
      currentVatRate={currentVatRate}
      vatUpdatedAt={vatSetting?.updated_at ?? null}
      isAdmin={isAdmin}
      allUsers={allUsers}
    />
  );
}
