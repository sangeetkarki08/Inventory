import Link from 'next/link';
import { BookOpen, Coins, ArrowUpFromLine } from 'lucide-react';

const REPORTS = [
  {
    href: '/reports/ledger',
    icon: BookOpen,
    title: 'Item Ledger',
    description:
      'For a chosen item, see every receipt and issue chronologically with running balance.',
    accent: 'info' as const,
  },
  {
    href: '/reports/valuation',
    icon: Coins,
    title: 'Stock Valuation',
    description:
      'Current FIFO inventory value, broken down by category and item.',
    accent: 'success' as const,
  },
  {
    href: '/reports/issues',
    icon: ArrowUpFromLine,
    title: 'Issue Analysis',
    description:
      'What was issued in a chosen date range — by issue type, site, and item.',
    accent: 'amber' as const,
  },
];

export default function ReportsHub() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted text-sm mt-1">
          Historical analysis and current valuation across your inventory
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const accents = {
            info: 'border-info/40 bg-info/5 text-info',
            success: 'border-success/40 bg-success/5 text-success',
            amber: 'border-accent/40 bg-accent/5 text-accent',
          } as const;
          return (
            <Link
              key={r.href}
              href={r.href}
              className={`bg-panel border ${accents[r.accent]} rounded-2xl p-5 hover:shadow-lg transition group`}
            >
              <div className="flex items-center gap-3 mb-3">
                <Icon size={22} />
                <h2 className="font-semibold text-lg text-text">{r.title}</h2>
              </div>
              <p className="text-sm text-muted leading-relaxed">{r.description}</p>
              <div className="mt-4 text-xs uppercase tracking-wider opacity-60 group-hover:opacity-100 transition">
                Open report →
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
