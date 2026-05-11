import { createClient } from '@/lib/supabase/server';
import { StockOutView } from './stock-out-view';

export const dynamic = 'force-dynamic';

interface StockOutRow {
  id: number;
  issued_at: string;
  quantity: number;
  total_cost: number;
  issue_type: 'Consumption' | 'Transfer' | 'Tool Issue' | 'Return';
  description: string | null;
  item_id: number;
  site_id: number;
  items: { id: number; name: string; unit: string } | null;
  sites: { id: number; name: string; type: string } | null;
}

interface ItemWithStock {
  id: number;
  name: string;
  unit: string;
  category: string;
  available: number;
}

interface SiteOption {
  id: number;
  name: string;
  type: string;
}

interface VStockRow {
  item_id: number | null;
  current_quantity: number | null;
}

export default async function StockOutPage() {
  const supabase = await createClient();

  const [issuesRes, itemsRes, sitesRes, stockRes] = await Promise.all([
    supabase
      .from('stock_out')
      .select(
        'id, issued_at, quantity, total_cost, issue_type, description, item_id, site_id, items(id, name, unit), sites(id, name, type)',
      )
      .order('issued_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(200),
    supabase
      .from('items')
      .select('id, name, unit, category')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase.from('sites').select('id, name, type').order('name', { ascending: true }),
    // v_item_stock gives us live availability for the picker.
    supabase
      .from('v_item_stock')
      .select('item_id, current_quantity'),
  ]);

  if (issuesRes.error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm">
        ⚠ Failed to load stock-out records: {issuesRes.error.message}
      </div>
    );
  }

  const issues = (issuesRes.data ?? []) as unknown as StockOutRow[];
  const sites  = (sitesRes.data  ?? []) as unknown as SiteOption[];
  const stockRows = (stockRes.data ?? []) as unknown as VStockRow[];

  // Build a map of item_id → current_quantity for the form.
  const stockMap = new Map<number, number>();
  for (const r of stockRows) {
    if (r.item_id != null) stockMap.set(r.item_id, Number(r.current_quantity ?? 0));
  }

  const itemsWithStock = ((itemsRes.data ?? []) as unknown as Array<{
    id: number; name: string; unit: string; category: string;
  }>).map((i) => ({
    ...i,
    available: stockMap.get(i.id) ?? 0,
  })) as ItemWithStock[];

  return (
    <StockOutView
      issues={issues}
      items={itemsWithStock}
      sites={sites}
    />
  );
}
