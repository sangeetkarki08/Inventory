'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Mode = 'login' | 'signup';

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName || email } },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      setInfo('Account created. Check your email to confirm, then come back and log in.');
      setMode('login');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === 'signup' && (
        <Field
          label="Full Name"
          type="text"
          value={fullName}
          onValueChange={setFullName}
          placeholder="Jane Doe"
          required
        />
      )}
      <Field
        label="Email"
        type="email"
        value={email}
        onValueChange={setEmail}
        placeholder="you@company.com"
        required
        autoComplete="email"
      />
      <Field
        label="Password"
        type="password"
        value={password}
        onValueChange={setPassword}
        placeholder="••••••••"
        required
        minLength={6}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
      />

      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
          ⚠ {error}
        </div>
      )}
      {info && (
        <div className="text-sm text-success bg-success/10 border border-success/30 rounded-lg px-3 py-2">
          ✓ {info}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-accent text-bg font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 transition flex items-center justify-center gap-2"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {mode === 'login' ? 'Login →' : 'Create account'}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login');
          setError(null);
          setInfo(null);
        }}
        className="w-full text-sm text-muted hover:text-text transition"
      >
        {mode === 'login'
          ? "Don't have an account? Sign up"
          : 'Already have an account? Login'}
      </button>
    </form>
  );
}

// ─── Field ───────────────────────────────────────────────────────────────────
// Wraps a labeled <input>. We rename the string-callback prop to `onValueChange`
// so it does not collide with the native React `onChange(event)` signature
// inherited from InputHTMLAttributes.
type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
};

function Field({ label, value, onValueChange, ...rest }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <input
        {...rest}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="w-full px-3 py-2 bg-bg border border-border rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
      />
    </div>
  );
}
