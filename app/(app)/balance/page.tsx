import { createClient } from '@/lib/supabase/server';
import { BalanceView } from './balance-view';

export const dynamic = 'force-dynamic';
export const revalidate = 10;

interface ItemRow {
  id: number;
  name: string;
  category: 'Consumable' | 'Tools' | 'Equipment' | 'Spare Parts';
  unit: string;
  reorder_level: number;
}

interface InRow {
  id: number;
  item_id: number;
  received_at: string;
  quantity: number;
  unit_rate: number;
  total_with_vat: number;
  supplier: string | null;
}

interface OutRow {
  id: number;
  item_id: number;
  issued_at: string;
  quantity: number;
  total_cost: number;
  issue_type: 'Consumption' | 'Transfer' | 'Tool Issue' | 'Return';
  sites: { id: number; name: string } | null;
}

export default async function BalancePage() {
  const supabase = await createClient();

  const [itemsRes, inRes, outRes] = await Promise.all([
    supabase
      .from('items')
      .select('id, name, category, unit, reorder_level')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('stock_in')
      .select('id, item_id, received_at, quantity, unit_rate, total_with_vat, supplier')
      .order('received_at', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('stock_out')
      .select('id, item_id, issued_at, quantity, total_cost, issue_type, sites(id, name)')
      .order('issued_at', { ascending: true })
      .order('id', { ascending: true }),
  ]);

  if (itemsRes.error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm">
        ⚠ Failed to load items: {itemsRes.error.message}
      </div>
    );
  }

  const items   = (itemsRes.data ?? []) as unknown as ItemRow[];
  const inRows  = (inRes.data    ?? []) as unknown as InRow[];
  const outRows = (outRes.data   ?? []) as unknown as OutRow[];

  return <BalanceView items={items} inRows={inRows} outRows={outRows} />;
}
