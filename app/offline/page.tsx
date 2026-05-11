import Link from 'next/link';
import { WifiOff } from 'lucide-react';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Offline — ConstructionIMS',
  description: 'You are offline. Cached pages and your local data are still available.',
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-text px-6">
      <div className="max-w-md w-full bg-panel border border-border rounded-2xl p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-danger/15 text-danger flex items-center justify-center">
          <WifiOff size={26} />
        </div>
        <h1 className="text-xl font-bold mb-2">You're offline</h1>
        <p className="text-sm text-muted mb-6">
          This page hasn't been cached yet, so we can't show it without a network connection.
          Pages you've already visited will still work, and any changes you make are saved locally
          and synced when you reconnect.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-accent text-bg font-semibold text-sm hover:opacity-90"
          >
            Go to dashboard
          </Link>
          <button
            type="button"
            onClick={() => typeof window !== 'undefined' && window.location.reload()}
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-panel border border-border text-sm hover:bg-border/30"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
