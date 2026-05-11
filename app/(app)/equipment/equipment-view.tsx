'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Wrench, Search } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { EquipmentForm } from './equipment-form';
import { deleteEquipment } from '@/lib/actions/equipment';
import { cn } from '@/lib/utils';

type EquipmentStatus = 'Active' | 'Under Repair' | 'Idle' | 'Retired';

interface EquipmentRow {
  id: number;
  name: string;
  category: string;
  model: string | null;
  serial_no: string | null;
  status: EquipmentStatus;
  site_id: number | null;
  notes: string | null;
  sites: { id: number; name: string; type: string } | null;
}

interface SiteOption {
  id: number;
  name: string;
  type: string;
}

type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; row: EquipmentRow };

const CATEGORY_FILTER_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'Excavator',       label: 'Excavator' },
  { value: 'Crane',           label: 'Crane' },
  { value: 'Bulldozer',       label: 'Bulldozer' },
  { value: 'Concrete Mixer',  label: 'Concrete Mixer' },
  { value: 'Vibrator',        label: 'Vibrator' },
  { value: 'Generator',       label: 'Generator' },
  { value: 'Compressor',      label: 'Compressor' },
  { value: 'Water Pump',      label: 'Water Pump' },
  { value: 'Scaffold',        label: 'Scaffold' },
  { value: 'Bar Cutter',      label: 'Bar Cutter' },
  { value: 'Welding Machine', label: 'Welding Machine' },
  { value: 'Other',           label: 'Other' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all',          label: 'All Statuses' },
  { value: 'Active',       label: 'Active' },
  { value: 'Under Repair', label: 'Under Repair' },
  { value: 'Idle',         label: 'Idle' },
  { value: 'Retired',      label: 'Retired' },
];

export function EquipmentView({
  equipment,
  sites,
}: {
  equipment: EquipmentRow[];
  sites: SiteOption[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return equipment.filter((e) => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (q) {
        const haystack = `${e.name} ${e.model ?? ''} ${e.serial_no ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [equipment, search, categoryFilter, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<EquipmentStatus, number> = {
      Active: 0,
      'Under Repair': 0,
      Idle: 0,
      Retired: 0,
    };
    for (const e of equipment) c[e.status]++;
    return c;
  }, [equipment]);

  function handleDelete(e: EquipmentRow) {
    if (!confirm(`Delete equipment "${e.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteEquipment(e.id);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipment</h1>
          <p className="text-muted text-sm mt-1">
            Heavy machinery, tools, and trackable assets across your sites
          </p>
        </div>
        <Button onClick={() => setModal({ kind: 'create' })}>
          <Plus size={16} /> New Equipment
        </Button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <CountCard label="Active" value={counts.Active} accent="success" />
        <CountCard label="Under Repair" value={counts['Under Repair']} accent="amber" />
        <CountCard label="Idle" value={counts.Idle} accent="info" />
        <CountCard label="Retired" value={counts.Retired} accent="muted" />
      </div>

      {/* Filters */}
      <div className="bg-panel border border-border rounded-2xl p-4 mb-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by name, model, or serial number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-48">
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={CATEGORY_FILTER_OPTIONS}
            />
          </div>
          <div className="w-44">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_FILTER_OPTIONS}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-panel border border-border rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Wrench className="mx-auto mb-3 text-muted" size={32} />
            <p className="text-sm text-muted">
              {equipment.length === 0
                ? 'No equipment yet. Click New Equipment to add machinery, generators, or tools.'
                : 'No equipment matches your filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg/40 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-5 py-3 text-left font-medium">Category</th>
                  <th className="px-5 py-3 text-left font-medium">Model</th>
                  <th className="px-5 py-3 text-left font-medium">Serial No.</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Site</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-t border-border/40 hover:bg-border/10">
                    <td className="px-5 py-3 font-medium">{e.name}</td>
                    <td className="px-5 py-3 text-muted">{e.category}</td>
                    <td className="px-5 py-3 text-muted">{e.model ?? '—'}</td>
                    <td className="px-5 py-3 text-muted font-mono text-xs">
                      {e.serial_no ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-5 py-3 text-muted">{e.sites?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => setModal({ kind: 'edit', row: e })}
                          className="p-1.5 rounded hover:bg-border/50 transition"
                          title="Edit"
                        >
                          <Pencil size={14} className="text-muted" />
                        </button>
                        <button
                          onClick={() => handleDelete(e)}
                          disabled={isPending}
                          className="p-1.5 rounded hover:bg-danger/10 transition"
                          title="Delete"
                        >
                          <Trash2 size={14} className="text-danger" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modal.kind !== 'none'}
        onClose={() => setModal({ kind: 'none' })}
        title={modal.kind === 'edit' ? 'Edit Equipment' : 'New Equipment'}
        size="md"
      >
        {modal.kind !== 'none' && (
          <EquipmentForm
            initial={modal.kind === 'edit' ? modal.row : null}
            sites={sites}
            onDone={() => {
              setModal({ kind: 'none' });
              router.refresh();
            }}
          />
        )}
      </Modal>
    </>
  );
}

function CountCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
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
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: EquipmentStatus }) {
  const map: Record<EquipmentStatus, string> = {
    Active:         'bg-success/15 text-success',
    'Under Repair': 'bg-accent/15 text-accent',
    Idle:           'bg-info/15 text-info',
    Retired:        'bg-border/40 text-muted',
  };
  return (
    <span className={cn('inline-block px-2 py-0.5 rounded-md text-xs font-semibold', map[status])}>
      {status}
    </span>
  );
}
