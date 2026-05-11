import { createClient } from '@/lib/supabase/server';
import { StockInView } from './stock-in-view';

export const dynamic = 'force-dynamic';

interface StockInRow {
  id: number;
  received_at: string;
  quantity: number;
  unit_rate: number;
  vat_rate: number;
  base_amount: number;
  vat_amount: number;
  total_with_vat: number;
  remaining_quantity: number;
  supplier: string | null;
  description: string | null;
  item_id: number;
  project_id: number | null;
  items: { id: number; name: string; unit: string; category: string } | null;
  projects: { id: number; name: string } | null;
}

interface ItemOption {
  id: number;
  name: string;
  unit: string;
  category: string;
}

interface ProjectOption {
  id: number;
  name: string;
}

export default async function StockInPage() {
  const supabase = await createClient();

  // Read default VAT rate from app_settings.
  const [batchesRes, itemsRes, projectsRes, vatRes] = await Promise.all([
    supabase
      .from('stock_in')
      .select(
        'id, received_at, quantity, unit_rate, vat_rate, base_amount, vat_amount, total_with_vat, remaining_quantity, supplier, description, item_id, project_id, items(id, name, unit, category), projects(id, name)',
      )
      .order('received_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(200),
    supabase
      .from('items')
      .select('id, name, unit, category')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase.from('projects').select('id, name').order('name', { ascending: true }),
    supabase.from('app_settings').select('value').eq('key', 'vat_rate').single(),
  ]);

  if (batchesRes.error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm">
        ⚠ Failed to load stock-in records: {batchesRes.error.message}
      </div>
    );
  }

  const batches  = (batchesRes.data  ?? []) as unknown as StockInRow[];
  const items    = (itemsRes.data    ?? []) as unknown as ItemOption[];
  const projects = (projectsRes.data ?? []) as unknown as ProjectOption[];

  // The default VAT rate is stored as a JSONB number; coerce safely.
  let defaultVatRate = 13;
  if (vatRes.data && vatRes.data.value != null) {
    const raw = vatRes.data.value as unknown;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(n)) defaultVatRate = n;
  }

  return (
    <StockInView
      batches={batches}
      items={items}
      projects={projects}
      defaultVatRate={defaultVatRate}
    />
  );
}
