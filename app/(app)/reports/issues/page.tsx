import Link from 'next/link';
import { ArrowLeft, ArrowUpFromLine } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency, cn } from '@/lib/utils';
import { DateRangeForm } from './date-range-form';

export const dynamic = 'force-dynamic';

type IssueType = 'Consumption' | 'Transfer' | 'Tool Issue' | 'Return';

interface IssueRow {
  id: number;
  issued_at: string;
  quantity: number;
  total_cost: number;
  issue_type: IssueType;
  items: { id: number; name: string; unit: string; category: string } | null;
  sites: { id: number; name: string; type: string } | null;
}

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function IssuesReport({ searchParams }: PageProps) {
  const sp = await searchParams;

  // Default range: last 30 days.
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const defaultFrom = thirtyDaysAgo.toISOString().slice(0, 10);
  const defaultTo   = today.toISOString().slice(0, 10);

  const from = isValidDate(sp.from) ? sp.from! : defaultFrom;
  const to   = isValidDate(sp.to)   ? sp.to!   : defaultTo;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stock_out')
    .select(
      'id, issued_at, quantity, total_cost, issue_type, items(id, name, unit, category), sites(id, name, type)',
    )
    .gte('issued_at', from)
    .lte('issued_at', to)
    .order('issued_at', { ascending: false });

  if (error) {
    return (
      <div>
        <BackLink />
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm">
          ⚠ Failed to load issues: {error.message}
        </div>
      </div>
    );
  }

  const rows = (data ?? []) as unknown as IssueRow[];

  // Summary aggregations.
  let totalCost = 0;
  let totalCount = 0;
  const byType: Record<IssueType, { count: number; cost: number }> = {
    Consumption: { count: 0, cost: 0 },
    Transfer:    { count: 0, cost: 0 },
    'Tool Issue':{ count: 0, cost: 0 },
    Return:      { count: 0, cost: 0 },
  };
  const bySite: Record<string, { count: number; cost: number; type: string }> = {};
  const byItem: Record<string, { count: number; cost: number; quantity: number; unit: string; category: string }> = {};

  for (const r of rows) {
    totalCount++;
    totalCost += Number(r.total_cost);
    byType[r.issue_type].count++;
    byType[r.issue_type].cost += Number(r.total_cost);

    if (r.sites) {
      const key = r.sites.name;
      if (!bySite[key]) bySite[key] = { count: 0, cost: 0, type: r.sites.type };
      bySite[key].count++;
      bySite[key].cost += Number(r.total_cost);
    }

    if (r.items) {
      const key = r.items.name;
      if (!byItem[key]) {
        byItem[key] = {
          count: 0, cost: 0, quantity: 0,
          unit: r.items.unit, category: r.items.category,
        };
      }
      byItem[key].count++;
      byItem[key].cost += Number(r.total_cost);
      byItem[key].quantity += Number(r.quantity);
    }
  }

  const topSites = Object.entries(bySite)
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 10);

  const topItems = Object.entries(byItem)
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 10);

  return (
    <div>
      <BackLink />
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ArrowUpFromLine size={22} className="text-accent" />
          <h1 className="text-2xl font-bold">Issue Analysis</h1>
        </div>
        <p className="text-muted text-sm">
          Issues from <strong className="text-text">{from}</strong> to{' '}
          <strong className="text-text">{to}</strong>
        </p>
      </div>

      <DateRangeForm initialFrom={from} initialTo={to} />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Total Issues"     value={String(totalCount)}            accent="info" />
        <Stat label="Consumption"      value={String(byType.Consumption.count)}  accent="success" />
        <Stat label="Tool Issues"      value={String(byType['Tool Issue'].count)} accent="amber" />
        <Stat label="Total Cost (FIFO)" value={formatCurrency(totalCost)}     accent="muted" />
      </div>

      {totalCount === 0 ? (
        <div className="bg-panel border border-border rounded-2xl p-12 text-center text-muted text-sm">
          No issues recorded in this date range.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* By Issue Type */}
          <div className="bg-panel border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-bg/30">
              <h3 className="font-semibold">By Issue Type</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-bg/40 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Type</th>
                  <th className="px-5 py-2.5 text-right font-medium">Count</th>
                  <th className="px-5 py-2.5 text-right font-medium">Cost</th>
                  <th className="px-5 py-2.5 text-right font-medium">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {(Object.entries(byType) as Array<[IssueType, { count: number; cost: number }]>)
                  .filter(([, d]) => d.count > 0)
                  .sort((a, b) => b[1].cost - a[1].cost)
                  .map(([type, data]) => (
                    <tr key={type} className="border-t border-border/40">
                      <td className="px-5 py-2.5">{type}</td>
                      <td className="px-5 py-2.5 text-right text-muted">{data.count}</td>
                      <td className="px-5 py-2.5 text-right font-semibold">
                        {formatCurrency(data.cost)}
                      </td>
                      <td className="px-5 py-2.5 text-right text-muted text-xs">
                        {totalCost > 0
                          ? `${((data.cost / totalCost) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* By Site (Top 10) */}
          <div className="bg-panel border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-bg/30">
              <h3 className="font-semibold">Top Sites by Cost</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-bg/40 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Site</th>
                  <th className="px-5 py-2.5 text-right font-medium">Issues</th>
                  <th className="px-5 py-2.5 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {topSites.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-6 text-center text-muted text-xs">
                      No site data
                    </td>
                  </tr>
                ) : (
                  topSites.map(([name, data]) => (
                    <tr key={name} className="border-t border-border/40">
                      <td className="px-5 py-2.5">
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-muted">{data.type}</div>
                      </td>
                      <td className="px-5 py-2.5 text-right text-muted">{data.count}</td>
                      <td className="px-5 py-2.5 text-right font-semibold">
                        {formatCurrency(data.cost)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* By Item (Top 10) */}
          <div className="bg-panel border border-border rounded-2xl overflow-hidden lg:col-span-2">
            <div className="px-5 py-3 border-b border-border bg-bg/30">
              <h3 className="font-semibold">Top Items by Issue Cost</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-bg/40 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Item</th>
                  <th className="px-5 py-2.5 text-left font-medium">Category</th>
                  <th className="px-5 py-2.5 text-right font-medium">Issues</th>
                  <th className="px-5 py-2.5 text-right font-medium">Quantity</th>
                  <th className="px-5 py-2.5 text-right font-medium">Cost (FIFO)</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map(([name, data]) => (
                  <tr key={name} className="border-t border-border/40">
                    <td className="px-5 py-2.5 font-medium">{name}</td>
                    <td className="px-5 py-2.5 text-muted">{data.category}</td>
                    <td className="px-5 py-2.5 text-right text-muted">{data.count}</td>
                    <td className="px-5 py-2.5 text-right text-muted">
                      {data.quantity.toFixed(2)} {data.unit}
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold">
                      {formatCurrency(data.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function isValidDate(s: string | undefined): boolean {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function BackLink() {
  return (
    <Link
      href="/reports"
      className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition mb-4"
    >
      <ArrowLeft size={14} />
      Back to Reports
    </Link>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'info' | 'success' | 'amber' | 'muted';
}) {
  const accents = {
    info:    'border-info/40    text-info',
    success: 'border-success/40 text-success',
    amber:   'border-accent/40  text-accent',
    muted:   'border-border     text-muted',
  } as const;
  return (
    <div className={cn('bg-panel border-l-4 border-y border-r border-border rounded-xl p-4', accents[accent])}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}
