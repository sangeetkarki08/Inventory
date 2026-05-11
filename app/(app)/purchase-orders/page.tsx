import { createClient } from '@/lib/supabase/server';
import { PurchaseOrdersView } from './purchase-orders-view';

export const dynamic = 'force-dynamic';

interface PurchaseOrderRow {
  id: number;
  po_number: string;
  supplier: string;
  status: 'Draft' | 'Sent' | 'Partially Received' | 'Received' | 'Cancelled';
  ordered_at: string;
  expected_at: string | null;
  notes: string | null;
  total_amount: number;
  purchase_order_lines: Array<{
    id: number;
    item_id: number;
    quantity: number;
    unit_rate: number;
    line_total: number;
    items: { id: number; name: string; unit: string } | null;
  }>;
}

interface ItemSuggestion {
  id: number;
  name: string;
  unit: string;
  reorder_level: number;
  max_level: number;
  preferred_supplier: string | null;
  current_quantity: number;
  shortage: number; // max_level - current_quantity (suggested order qty)
}

interface ItemOption {
  id: number;
  name: string;
  unit: string;
  preferred_supplier: string | null;
}

interface VStockRow {
  item_id: number | null;
  current_quantity: number | null;
}

export default async function PurchaseOrdersPage() {
  const supabase = await createClient();

  const [posRes, itemsRes, stockRes] = await Promise.all([
    supabase
      .from('purchase_orders')
      .select(
        'id, po_number, supplier, status, ordered_at, expected_at, notes, total_amount, purchase_order_lines(id, item_id, quantity, unit_rate, line_total, items(id, name, unit))',
      )
      .order('ordered_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(200),
    supabase
      .from('items')
      .select('id, name, unit, reorder_level, max_level, preferred_supplier')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('v_item_stock')
      .select('item_id, current_quantity'),
  ]);

  if (posRes.error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm">
        ⚠ Failed to load purchase orders: {posRes.error.message}
      </div>
    );
  }

  const purchaseOrders = (posRes.data ?? []) as unknown as PurchaseOrderRow[];

  // Map item_id → current_quantity for the suggestion logic.
  const stockMap = new Map<number, number>();
  for (const r of (stockRes.data ?? []) as unknown as VStockRow[]) {
    if (r.item_id != null) stockMap.set(r.item_id, Number(r.current_quantity ?? 0));
  }

  const allItems = (itemsRes.data ?? []) as unknown as Array<{
    id: number;
    name: string;
    unit: string;
    reorder_level: number;
    max_level: number;
    preferred_supplier: string | null;
  }>;

  // Suggestions: items where current_quantity <= reorder_level AND max_level > current_quantity
  const suggestions: ItemSuggestion[] = [];
  for (const it of allItems) {
    const current = stockMap.get(it.id) ?? 0;
    const reorder = Number(it.reorder_level);
    const max     = Number(it.max_level);
    if (current <= reorder && max > current) {
      suggestions.push({
        id:                 it.id,
        name:               it.name,
        unit:               it.unit,
        reorder_level:      reorder,
        max_level:          max,
        preferred_supplier: it.preferred_supplier,
        current_quantity:   current,
        shortage:           Math.max(0, max - current),
      });
    }
  }

  const itemOptions: ItemOption[] = allItems.map((i) => ({
    id:                 i.id,
    name:               i.name,
    unit:               i.unit,
    preferred_supplier: i.preferred_supplier,
  }));

  return (
    <PurchaseOrdersView
      purchaseOrders={purchaseOrders}
      suggestions={suggestions}
      itemOptions={itemOptions}
    />
  );
}
