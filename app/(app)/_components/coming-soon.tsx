import { Construction } from 'lucide-react';

export function ComingSoon({ page, description }: { page: string; description?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">{page}</h1>
      {description && <p className="text-muted text-sm mb-6">{description}</p>}

      <div className="bg-panel border border-border rounded-2xl p-12 text-center mt-8">
        <Construction className="mx-auto mb-4 text-accent" size={48} />
        <h2 className="text-lg font-semibold mb-2">Coming soon</h2>
        <p className="text-muted text-sm max-w-md mx-auto">
          This module will be built on top of the data layer that&apos;s already in place.
          The schema, types, and FIFO engine for this section are ready — only the UI is pending.
        </p>
      </div>
    </div>
  );
}
