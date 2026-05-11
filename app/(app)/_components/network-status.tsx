'use client';

import { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi, RefreshCw, CloudUpload, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSyncState, syncManager } from '@/lib/offline';

/**
 * Status indicator showing the live online/offline state plus the offline
 * outbox queue.
 *
 *   • Offline → red pill: "You're offline — N changes queued"
 *   • Pushing/pulling → amber pill with spinner
 *   • Errors / dead-letters → red exclamation pill, click to retry
 *   • Online & in sync → renders nothing (so we don't clutter the UI)
 *   • Just-reconnected → green "Back online" toast for 3 seconds
 */
export function NetworkStatus() {
  const state = useSyncState();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOffline = useRef(false);

  // Show a brief "Back online" toast only when transitioning from offline → online.
  useEffect(() => {
    if (!state.isOnline) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current && state.phase === 'idle') {
      wasOffline.current = false;
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(t);
    }
  }, [state.isOnline, state.phase]);

  const handleRetry = () => {
    void syncManager.runSync();
  };

  // Offline pill.
  if (!state.isOnline) {
    return (
      <Pill tone="danger">
        <WifiOff size={16} />
        <span>You're offline</span>
        {state.pendingCount > 0 && (
          <Badge>{state.pendingCount} queued</Badge>
        )}
      </Pill>
    );
  }

  // Pushing / pulling.
  if (state.phase === 'pushing' || state.phase === 'pulling') {
    return (
      <Pill tone="amber">
        <RefreshCw size={16} className="animate-spin" />
        <span>{state.phase === 'pushing' ? 'Syncing changes…' : 'Refreshing data…'}</span>
        {state.pendingCount > 0 && <Badge>{state.pendingCount}</Badge>}
      </Pill>
    );
  }

  // Pending changes but idle — usually transient before next sync; show a
  // gentle nudge with a "Sync now" button.
  if (state.pendingCount > 0) {
    return (
      <Pill tone="amber" onClick={handleRetry} role="button" title="Sync now">
        <CloudUpload size={16} />
        <span>{state.pendingCount} change{state.pendingCount === 1 ? '' : 's'} pending</span>
        <RefreshCw size={12} />
      </Pill>
    );
  }

  // Dead-letter items need user attention.
  if (state.deadCount > 0) {
    return (
      <Pill tone="danger" onClick={handleRetry} role="button" title="Retry failed sync">
        <AlertTriangle size={16} />
        <span>{state.deadCount} change{state.deadCount === 1 ? '' : 's'} failed</span>
      </Pill>
    );
  }

  // Error from the last sync attempt.
  if (state.phase === 'error') {
    return (
      <Pill tone="danger" onClick={handleRetry} role="button" title="Retry">
        <AlertTriangle size={16} />
        <span>Sync failed — retry</span>
      </Pill>
    );
  }

  if (showReconnected) {
    return (
      <Pill tone="success">
        <Wifi size={16} />
        <span>Back online</span>
      </Pill>
    );
  }

  return null;
}

function Pill({
  tone,
  children,
  onClick,
  role,
  title,
}: {
  tone: 'success' | 'amber' | 'danger';
  children: React.ReactNode;
  onClick?: () => void;
  role?: string;
  title?: string;
}) {
  const tones: Record<typeof tone, string> = {
    success: 'bg-success/15 text-success border-success/30',
    amber:   'bg-accent/15 text-accent border-accent/30',
    danger:  'bg-danger/15 text-danger border-danger/30',
  };
  return (
    <div
      onClick={onClick}
      role={role}
      title={title}
      className={cn(
        'fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lifted',
        'flex items-center gap-2 text-sm font-medium border',
        onClick && 'cursor-pointer hover:opacity-90 active:opacity-80',
        tones[tone],
      )}
    >
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-bg/40">
      {children}
    </span>
  );
}
