import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-bg via-bg to-panel">
      <div className="w-full max-w-md bg-panel border border-border rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏗️</div>
          <h1 className="text-2xl font-bold">ConstructionIMS</h1>
          <p className="text-muted text-sm mt-2">Construction Inventory &amp; Store Management</p>
        </div>
        <LoginForm />
        <p className="text-xs text-muted text-center mt-6">
          v3 · Powered by Supabase
        </p>
      </div>
    </div>
  );
}
