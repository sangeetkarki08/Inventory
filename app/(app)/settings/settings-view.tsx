'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings as SettingsIcon,
  Users,
  Info,
  Save,
  ShieldCheck,
  UserCheck,
  UserX,
  CheckCircle2,
} from 'lucide-react';
import { Button, Input } from '@/components/ui/form';
import {
  updateVatRate,
  updateUserRole,
  toggleUserActive,
} from '@/lib/actions/settings';
import { cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  full_name: string;
  role: 'Admin' | 'Store Manager';
  is_active: boolean;
  created_at: string;
}

type Tab = 'general' | 'users' | 'about';

export function SettingsView({
  currentUser,
  userEmail,
  currentVatRate,
  vatUpdatedAt,
  isAdmin,
  allUsers,
}: {
  currentUser: UserProfile;
  userEmail: string;
  currentVatRate: number;
  vatUpdatedAt: string | null;
  isAdmin: boolean;
  allUsers: UserProfile[];
}) {
  const [tab, setTab] = useState<Tab>('general');

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted text-sm mt-1">
          System preferences, user management, and about info
        </p>
      </div>

      {/* Tab nav */}
      <div className="bg-panel border border-border rounded-2xl mb-4 inline-flex p-1 gap-1">
        <TabButton
          active={tab === 'general'}
          onClick={() => setTab('general')}
          icon={<SettingsIcon size={14} />}
          label="General"
        />
        {isAdmin && (
          <TabButton
            active={tab === 'users'}
            onClick={() => setTab('users')}
            icon={<Users size={14} />}
            label="Users"
          />
        )}
        <TabButton
          active={tab === 'about'}
          onClick={() => setTab('about')}
          icon={<Info size={14} />}
          label="About"
        />
      </div>

      {tab === 'general' && (
        <GeneralPanel
          currentVatRate={currentVatRate}
          vatUpdatedAt={vatUpdatedAt}
          isAdmin={isAdmin}
        />
      )}

      {tab === 'users' && isAdmin && (
        <UsersPanel currentUserId={currentUser.id} allUsers={allUsers} />
      )}

      {tab === 'about' && (
        <AboutPanel currentUser={currentUser} userEmail={userEmail} />
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2',
        active
          ? 'bg-accent text-bg'
          : 'text-muted hover:text-text hover:bg-border/40',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════ General Panel
function GeneralPanel({
  currentVatRate,
  vatUpdatedAt,
  isAdmin,
}: {
  currentVatRate: number;
  vatUpdatedAt: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [vatRate, setVatRate] = useState(String(currentVatRate));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await updateVatRate(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    });
  }

  return (
    <div className="bg-panel border border-border rounded-2xl p-6 max-w-2xl">
      <h2 className="font-semibold text-lg mb-1">Default VAT Rate</h2>
      <p className="text-sm text-muted mb-4">
        Pre-fills the VAT field on new Stock IN entries. Existing batches keep their
        original VAT rate — this only affects new entries going forward.
      </p>

      {!isAdmin && (
        <div className="bg-info/10 border border-info/30 rounded-lg p-3 text-sm mb-4">
          ℹ Only Admins can change system settings. You can view the current value below.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto] gap-3 items-end">
          <Input
            name="vat_rate"
            type="number"
            step="0.1"
            min="0"
            max="100"
            label="VAT %"
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
            disabled={!isAdmin}
            required
          />
          {isAdmin && (
            <Button type="submit" loading={isPending}>
              <Save size={14} /> Save
            </Button>
          )}
        </div>

        {vatUpdatedAt && (
          <div className="text-xs text-muted">
            Last updated: {new Date(vatUpdatedAt).toLocaleString()}
          </div>
        )}

        {error && (
          <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
            ⚠ {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-success bg-success/10 border border-success/30 rounded-lg px-3 py-2 flex items-center gap-2">
            <CheckCircle2 size={14} />
            VAT rate updated successfully.
          </div>
        )}
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ Users Panel
function UsersPanel({
  currentUserId,
  allUsers,
}: {
  currentUserId: string;
  allUsers: UserProfile[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(user: UserProfile, newRole: 'Admin' | 'Store Manager') {
    if (user.role === newRole) return;
    if (!confirm(
      `Change ${user.full_name}'s role from ${user.role} to ${newRole}?`,
    )) return;

    setError(null);
    startTransition(async () => {
      const res = await updateUserRole(user.id, newRole);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function handleActiveToggle(user: UserProfile) {
    const wantedActive = !user.is_active;
    setError(null);
    startTransition(async () => {
      const res = await toggleUserActive(user.id, wantedActive);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-panel border border-border rounded-2xl p-5">
        <h2 className="font-semibold text-lg mb-1">User Management</h2>
        <p className="text-sm text-muted">
          Promote users between Admin and Store Manager. New signups default to Store
          Manager and can be promoted here. Note: changes take effect on the user&apos;s
          next login.
        </p>
      </div>

      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
          ⚠ {error}
        </div>
      )}

      <div className="bg-panel border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg/40 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3 text-left font-medium">User</th>
              <th className="px-5 py-3 text-left font-medium">Role</th>
              <th className="px-5 py-3 text-left font-medium">Status</th>
              <th className="px-5 py-3 text-left font-medium">Joined</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-t border-border/40">
                  <td className="px-5 py-3">
                    <div className="font-medium flex items-center gap-2">
                      {u.full_name}
                      {isSelf && (
                        <span className="text-[10px] uppercase font-semibold text-info bg-info/15 px-1.5 py-0.5 rounded">
                          You
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-5 py-3">
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
                        <UserCheck size={12} />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted font-medium">
                        <UserX size={12} />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex gap-2 items-center">
                      {/* Role switch */}
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          handleRoleChange(
                            u,
                            u.role === 'Admin' ? 'Store Manager' : 'Admin',
                          )
                        }
                        disabled={isPending || isSelf}
                        title={isSelf ? "You can't change your own role" : undefined}
                      >
                        {u.role === 'Admin' ? 'Demote to Manager' : 'Promote to Admin'}
                      </Button>

                      {/* Active toggle */}
                      <button
                        onClick={() => handleActiveToggle(u)}
                        disabled={isPending || isSelf}
                        title={
                          isSelf
                            ? "You can't deactivate yourself"
                            : u.is_active
                              ? 'Deactivate user'
                              : 'Activate user'
                        }
                        className="p-1.5 rounded hover:bg-border/40 transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {u.is_active ? (
                          <UserX size={14} className="text-danger" />
                        ) : (
                          <UserCheck size={14} className="text-success" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: 'Admin' | 'Store Manager' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold',
        role === 'Admin'
          ? 'bg-accent/15 text-accent'
          : 'bg-info/15 text-info',
      )}
    >
      {role === 'Admin' && <ShieldCheck size={11} />}
      {role}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════ About Panel
function AboutPanel({
  currentUser,
  userEmail,
}: {
  currentUser: UserProfile;
  userEmail: string;
}) {
  const facts: Array<{ label: string; value: string }> = [
    { label: 'Application',    value: 'ConstructionIMS v3' },
    { label: 'Database',       value: 'Supabase (PostgreSQL)' },
    { label: 'FIFO Engine',    value: 'process_stock_out RPC' },
    { label: 'Schema Version', value: 'v3 (initial)' },
    { label: 'Currency',       value: 'NPR (Nepali Rupee)' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-panel border border-border rounded-2xl p-6">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Info size={18} />
          Your Account
        </h2>
        <dl className="space-y-3">
          <Field label="Name"   value={currentUser.full_name} />
          <Field label="Email"  value={userEmail} />
          <Field label="Role"   value={
            <RoleBadge role={currentUser.role} />
          } />
          <Field label="Status" value={
            currentUser.is_active
              ? <span className="text-success">Active</span>
              : <span className="text-muted">Inactive</span>
          } />
          <Field label="Joined" value={new Date(currentUser.created_at).toLocaleDateString()} />
        </dl>
      </div>

      <div className="bg-panel border border-border rounded-2xl p-6">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <SettingsIcon size={18} />
          System
        </h2>
        <dl className="space-y-3">
          {facts.map((f) => (
            <Field key={f.label} label={f.label} value={f.value} />
          ))}
        </dl>
      </div>

      <div className="md:col-span-2 bg-panel border border-border rounded-2xl p-6">
        <h2 className="font-semibold text-lg mb-2">Stack</h2>
        <p className="text-sm text-muted mb-4">
          Built on Next.js 15 (App Router), TypeScript, Tailwind CSS, and Supabase
          (PostgreSQL + Auth + RLS). Stock OUT runs through a transaction-safe
          PostgreSQL function that locks FIFO batches with{' '}
          <code className="px-1 py-0.5 bg-bg rounded text-xs">FOR UPDATE</code>{' '}
          so concurrent issues never double-consume.
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            'Next.js 15', 'TypeScript', 'Tailwind CSS', 'Supabase',
            'PostgreSQL', 'Row Level Security', 'Server Actions',
            'react-hook-form', 'zod', 'Lucide icons',
          ].map((t) => (
            <span
              key={t}
              className="px-2 py-1 bg-bg border border-border rounded-md text-muted"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
