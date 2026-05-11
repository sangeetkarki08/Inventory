'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Building2,
  MapPin,
  Wrench,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Scale,
  ClipboardList,
  TrendingUp,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LogoutButton } from './logout-button';

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };
type NavSection = { section: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    section: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    section: 'Organization',
    items: [
      { href: '/companies', label: 'Companies & Projects', icon: Building2 },
      { href: '/sites', label: 'Sites & Locations', icon: MapPin },
      { href: '/equipment', label: 'Equipment', icon: Wrench },
    ],
  },
  {
    section: 'Inventory',
    items: [
      { href: '/items', label: 'Item Master', icon: Package },
      { href: '/stock-in', label: 'Stock IN', icon: ArrowDownToLine },
      { href: '/stock-out', label: 'Stock OUT', icon: ArrowUpFromLine },
      { href: '/balance', label: 'Balance', icon: Scale },
    ],
  },
  {
    section: 'Procurement',
    items: [{ href: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList }],
  },
  {
    section: 'Insights',
    items: [{ href: '/reports', label: 'Reports', icon: TrendingUp }],
  },
  {
    section: 'System',
    items: [{ href: '/settings', label: 'Settings', icon: Settings }],
  },
];

export function Sidebar({
  profile,
  userEmail,
}: {
  profile: { full_name: string; role: string };
  userEmail: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the sidebar whenever the user navigates to a new page on mobile.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when the mobile sidebar is open.
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [mobileOpen]);

  // Close on ESC.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <>
      {/* ── Mobile-only top bar with hamburger ──────────────────────────── */}
      <div className="
        md:hidden
        fixed top-0 left-0 right-0 z-30
        h-14 px-4
        bg-panel/95 backdrop-blur-xl border-b border-border
        flex items-center justify-between
      ">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-surface transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <Link href="/dashboard" prefetch className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-amber flex items-center justify-center">
            <span className="text-sm">🏗️</span>
          </div>
          <span className="font-bold text-sm tracking-tight">ConstructionIMS</span>
        </Link>
        <div className="
          w-8 h-8 rounded-full
          bg-gradient-amber
          text-bg font-bold text-sm
          flex items-center justify-center
        ">
          {(profile.full_name || userEmail || '?')[0].toUpperCase()}
        </div>
      </div>

      {/* ── Mobile backdrop (when sidebar is open) ──────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-bg/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar (slides on mobile, fixed on desktop) ────────────────── */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen w-64 z-50',
          'bg-panel/95 backdrop-blur-xl',
          'border-r border-border',
          'flex flex-col',
          'shadow-lifted',
          'transition-transform duration-200',
          // Mobile: slide in/out
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: always visible
          'md:translate-x-0 md:z-10',
        )}
      >
        {/* Logo block */}
        <div className="relative p-5 border-b border-border overflow-hidden">
          <div className="absolute inset-0 bg-gradient-radial pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <Link
              href="/dashboard"
              prefetch
              className="flex items-center gap-3 group"
              onClick={() => setMobileOpen(false)}
            >
              <div className="
                w-10 h-10 rounded-xl
                bg-gradient-amber
                flex items-center justify-center
                shadow-glow-amber
                group-hover:scale-105 transition-transform
              ">
                <span className="text-xl">🏗️</span>
              </div>
              <div>
                <div className="font-bold leading-tight tracking-tight">
                  ConstructionIMS
                </div>
                <div className="text-[11px] text-muted tracking-wide uppercase">
                  v3 · Store Management
                </div>
              </div>
            </Link>
            {/* Close button — only visible on mobile when sidebar is open */}
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1.5 rounded-lg hover:bg-surface text-muted hover:text-text transition-colors"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {NAV.map((sec) => (
            <div key={sec.section} className="mb-5">
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted/60 px-3 mb-2 font-semibold">
                {sec.section}
              </div>
              {sec.items.map((it) => {
                const Icon = it.icon;
                const active = pathname === it.href || pathname.startsWith(it.href + '/');
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    prefetch
                    className={cn(
                      'relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                      'mb-0.5',
                      active
                        ? 'bg-gradient-to-r from-accent/15 to-accent/5 text-accent font-medium'
                        : 'text-text/75 hover:bg-surface hover:text-text',
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-accent rounded-r-full shadow-glow-amber" />
                    )}
                    <Icon size={16} className={cn(
                      'transition-transform',
                      active ? 'scale-110' : '',
                    )} />
                    {it.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User card */}
        <div className="p-3 border-t border-border bg-bg/40">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-border/60">
            <div className="
              w-9 h-9 rounded-full
              bg-gradient-amber
              text-bg font-bold
              flex items-center justify-center flex-shrink-0
              shadow-soft
            ">
              {(profile.full_name || userEmail || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{profile.full_name}</div>
              <div className="text-[11px] text-muted truncate uppercase tracking-wide">{profile.role}</div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>
    </>
  );
}
