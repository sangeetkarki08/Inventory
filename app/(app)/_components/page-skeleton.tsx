// Generic page-loading skeleton matching the app's panel/border aesthetic.
// Used by every loading.tsx file in the (app) routes.

export function PageSkeleton({
  showStats = true,
  showFilters = true,
  rows = 5,
}: {
  showStats?: boolean;
  showFilters?: boolean;
  rows?: number;
}) {
  return (
    <div className="animate-pulse">
      {/* Title bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-border/40 rounded" />
          <div className="h-3 w-72 bg-border/30 rounded" />
        </div>
        <div className="h-9 w-32 bg-border/40 rounded-lg" />
      </div>

      {showStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-panel border border-border rounded-xl p-4">
              <div className="h-5 w-20 bg-border/40 rounded mb-2" />
              <div className="h-3 w-24 bg-border/30 rounded" />
            </div>
          ))}
        </div>
      )}

      {showFilters && (
        <div className="bg-panel border border-border rounded-2xl p-4 mb-4 flex gap-3">
          <div className="flex-1 h-9 bg-border/30 rounded-lg" />
          <div className="w-48 h-9 bg-border/30 rounded-lg" />
        </div>
      )}

      <div className="bg-panel border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 bg-bg/40 border-b border-border flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 w-20 bg-border/40 rounded" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="border-t border-border/40 px-5 py-3 flex gap-4">
            {Array.from({ length: 5 }).map((__, j) => (
              <div key={j} className="h-4 w-24 bg-border/20 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
