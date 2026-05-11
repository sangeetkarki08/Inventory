import { createClient } from '@/lib/supabase/server';
import { EquipmentView } from './equipment-view';

export const dynamic = 'force-dynamic';

interface EquipmentRow {
  id: number;
  name: string;
  category: string;
  model: string | null;
  serial_no: string | null;
  status: 'Active' | 'Under Repair' | 'Idle' | 'Retired';
  site_id: number | null;
  notes: string | null;
  created_at: string;
  sites: { id: number; name: string; type: string } | null;
}

interface SiteOption {
  id: number;
  name: string;
  type: string;
}

export default async function EquipmentPage() {
  const supabase = await createClient();

  const [equipmentRes, sitesRes] = await Promise.all([
    supabase
      .from('equipment')
      .select(
        'id, name, category, model, serial_no, status, site_id, notes, created_at, sites(id, name, type)',
      )
      .order('name', { ascending: true }),
    supabase.from('sites').select('id, name, type').order('name', { ascending: true }),
  ]);

  if (equipmentRes.error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm">
        ⚠ Failed to load equipment: {equipmentRes.error.message}
      </div>
    );
  }

  const equipment = (equipmentRes.data ?? []) as unknown as EquipmentRow[];
  const sites = (sitesRes.data ?? []) as unknown as SiteOption[];

  return <EquipmentView equipment={equipment} sites={sites} />;
}
