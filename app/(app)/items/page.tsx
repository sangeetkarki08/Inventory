import { createClient } from '@/lib/supabase/server';
import { ItemsView } from './items-view';

export const dynamic = 'force-dynamic';

interface ItemRow {
  id: number;
  name: string;
  category: 'Consumable' | 'Tools' | 'Equipment' | 'Spare Parts';
  unit: string;
  reorder_level: number;
  max_level: number;
  preferred_supplier: string | null;
  equipment_id: number | null;
  description: string | null;
  is_active: boolean;
  equipment: { id: number; name: string; serial_no: string | null } | null;
}

interface EquipmentOption {
  id: number;
  name: string;
  serial_no: string | null;
}

export default async function ItemsPage() {
  // Best-effort server-side fetch. If Supabase is unreachable (offline server
  // or network issue), we render with an empty seed and let the client-side
  // offline layer hydrate from IndexedDB.
  let items: ItemRow[] = [];
  let equipment: EquipmentOption[] = [];

  try {
    const supabase = await createClient();
    const [itemsRes, equipmentRes] = await Promise.all([
      supabase
        .from('items')
        .select(
          'id, name, category, unit, reorder_level, max_level, preferred_supplier, equipment_id, description, is_active, equipment(id, name, serial_no)',
        )
        .order('name', { ascending: true }),
      supabase
        .from('equipment')
        .select('id, name, serial_no')
        .order('name', { ascending: true }),
    ]);

    if (!itemsRes.error) {
      items = (itemsRes.data ?? []) as unknown as ItemRow[];
    }
    if (!equipmentRes.error) {
      equipment = (equipmentRes.data ?? []) as unknown as EquipmentOption[];
    }
  } catch {
    // Swallow: the ItemsView client component will pick up IndexedDB data.
  }

  return <ItemsView items={items} equipment={equipment} />;
}
