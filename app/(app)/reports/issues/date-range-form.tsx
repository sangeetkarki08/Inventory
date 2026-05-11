'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Input } from '@/components/ui/form';

export function DateRangeForm({
  initialFrom,
  initialTo,
}: {
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to,   setTo]   = useState(initialTo);

  function apply() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to)   params.set('to', to);
    const qs = params.toString();
    router.push(`/reports/issues${qs ? `?${qs}` : ''}`);
  }

  function preset(days: number) {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    const f = start.toISOString().slice(0, 10);
    const t = today.toISOString().slice(0, 10);
    setFrom(f);
    setTo(t);
    const params = new URLSearchParams({ from: f, to: t });
    router.push(`/reports/issues?${params.toString()}`);
  }

  return (
    <div className="bg-panel border border-border rounded-2xl p-4 mb-4 flex flex-col md:flex-row md:items-end gap-3">
      <div className="flex-1 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-semibold">From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-semibold">To</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => preset(7)}>
          Last 7 days
        </Button>
        <Button type="button" variant="secondary" onClick={() => preset(30)}>
          Last 30 days
        </Button>
        <Button type="button" variant="secondary" onClick={() => preset(90)}>
          Last 90 days
        </Button>
        <Button type="button" onClick={apply}>
          Apply
        </Button>
      </div>
    </div>
  );
}
