'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      title="Logout"
      className="p-2 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition"
    >
      <LogOut size={16} />
    </button>
  );
}
