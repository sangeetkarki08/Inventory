'use client';

import { useEffect } from 'react';
import { syncManager } from './sync';

/**
 * Starts the SyncManager on mount, stops on unmount.
 *
 * Drop this once near the root of the app (inside Providers). It does not
 * render anything itself — UI lives in <NetworkStatus />.
 */
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void syncManager.start();
    return () => syncManager.stop();
  }, []);
  return <>{children}</>;
}
