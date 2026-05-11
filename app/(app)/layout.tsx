import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from './_components/sidebar';
import { NetworkStatus } from './_components/network-status';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar
        profile={profile ?? { full_name: user.email ?? 'User', role: 'Store Manager' }}
        userEmail={user.email ?? ''}
      />
      <main className="md:ml-64 pt-14 md:pt-0 px-4 py-4 md:px-8 md:py-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
      <NetworkStatus />
    </div>
  );
}
