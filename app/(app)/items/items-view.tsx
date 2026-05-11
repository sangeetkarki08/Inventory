'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Package, Search, EyeOff, Eye } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { ItemForm } from './item-form';
import { deleteItem } from '@/lib/actions/items';
import { cn } from '@/lib/utils';
import { offlineDelete, useOfflineTable, useSyncState } from '@/lib/offline';

type ItemCategory = 'Consumable' | 'Tools' | 'Equipment' | 'Spare Parts';

interface ItemRow {
  id: number;
  name: string;
  category: ItemCategory;
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

type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; row: ItemRow };

const CATEGORY_FILTER_OPTIONS = [
  { value: 'all',          label: 'All Categories' },
  { value: 'Consumable',   label: 'Consumable' },
  { value: 'Tools',        label: 'Tools' },
  { value: 'Equipment',    label: 'Equipment' },
  { value: 'Spare Parts',  label: 'Spare Parts' },
];

export function ItemsView({
  items,
  equipment,
}: {
  items: ItemRow[];
  equipment: EquipmentOption[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [isPending, startTransition] = useTransition();
  const sync = useSyncState();

  // While online the server-rendered `items` seed is authoritative. While
  // offline we fall back to the IndexedDB mirror so the table still works.
  const { rows: offlineRows } = useOfflineTable<ItemRow>('items', items);
  const liveItems = sync.isOnline ? items : offlineRows;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return liveItems.filter((i) => {
      if (!showInactive && !i.is_active) return false;
      if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
      if (q) {
        const hay = `${i.name} ${i.preferred_supplier ?? ''} ${i.equipment?.name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [liveItems, search, categoryFilter, showInactive]);

  const counts = useMemo(() => {
    const c: Record<ItemCategory, number> = {
      Consumable: 0,
      Tools: 0,
      Equipment: 0,
      'Spare Parts': 0,
    };
    for (const i of liveItems) {
      if (i.is_active) c[i.category]++;
    }
    return c;
  }, [liveItems]);

  function handleDelete(i: ItemRow) {
    if (
      !confirm(
        `Delete item "${i.name}"? This cannot be undone. Note: items with stock movements cannot be deleted.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await offlineDelete(deleteItem, i.id, { table: 'items' });
      if (!res.ok) alert(res.error);
      else if (sync.isOnline) router.refresh();
    });
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Item Master</h1>
          <p className="text-muted text-sm mt-1">
            The single source of truth for everything you stock — consumables, tools, machinery, and spare parts
          </p>
        </div>
        <Button onClick={() => setModal({ kind: 'create' })}>
          <Plus size={16} /> New Item
        </Button>
      </div>

      {/* Category counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <CountCard label="Consumables"  value={counts.Consumable}     accent="success" />
        <CountCard label="Tools"        value={counts.Tools}          accent="info" />
        <CountCard label="Equipment"    value={counts.Equipment}      accent="amber" />
        <CountCard label="Spare Parts"  value={counts['Spare Parts']} accent="muted" />
      </div>

      {/* Filters */}
      <div className="bg-panel border border-border rounded-2xl p-4 mb-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by name, supplier, or equipment…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-48">
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={CATEGORY_FILTER_OPTIONS}
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => setShowInactive((v) => !v)}
          title={showInactive ? 'Hide inactive items' : 'Show inactive items'}
        >
          {showInactive ? <EyeOff size={14} /> : <Eye size={14} />}
          {showInactive ? 'Hide inactive' : 'Show inactive'}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-panel border border-border rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="mx-auto mb-3 text-muted" size={32} />
            <p className="text-sm text-muted">
              {items.length === 0
                ? 'No items yet. Click New Item to add your first one.'
                : 'No items match your filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg/40 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Item</th>
                  <th className="px-5 py-3 text-left font-medium">Category</th>
                  <th className="px-5 py-3 text-left font-medium">Unit</th>
                  <th className="px-5 py-3 text-right font-medium">Reorder</th>
                  <th className="px-5 py-3 text-right font-medium">Max</th>
                  <th className="px-5 py-3 text-left font-medium">Linked To</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr
                    key={i.id}
                    className={cn(
                      'border-t border-border/40 hover:bg-border/10',
                      !i.is_active && 'opacity-50',
                    )}
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium flex items-center gap-2">
                        {i.name}
                        {!i.is_active && (
                          <span className="text-[10px] uppercase font-semibold text-muted bg-border/40 px-1.5 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      {i.preferred_supplier && (
                        <div className="text-xs text-muted">
                          Supplier: {i.preferred_supplier}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <CategoryBadge category={i.category} />
                    </td>
                    <td className="px-5 py-3 text-muted">{i.unit}</td>
                    <td className="px-5 py-3 text-right text-muted">
                      {Number(i.reorder_level).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right text-muted">
                      {Number(i.max_level).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {i.equipment ? (
                        <div>
                          <div className="text-xs">{i.equipment.name}</div>
                          {i.equipment.serial_no && (
                            <div className="text-[10px] font-mono text-muted/70">
                              {i.equipment.serial_no}
                            </div>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => setModal({ kind: 'edit', row: i })}
                          className="p-1.5 rounded hover:bg-border/50 transition"
                          title="Edit"
                        >
                          <Pencil size={14} className="text-muted" />
                        </button>
                        <button
                          onClick={() => handleDelete(i)}
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
        title={modal.kind === 'edit' ? 'Edit Item' : 'New Item'}
        size="lg"
      >
        {modal.kind !== 'none' && (
          <ItemForm
            initial={modal.kind === 'edit' ? modal.row : null}
            equipment={equipment}
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

function CategoryBadge({ category }: { category: ItemCategory }) {
  const map: Record<ItemCategory, string> = {
    Consumable:    'bg-success/15 text-success',
    Tools:         'bg-info/15 text-info',
    Equipment:     'bg-accent/15 text-accent',
    'Spare Parts': 'bg-border/40 text-muted',
  };
  return (
    <span className={cn('inline-block px-2 py-0.5 rounded-md text-xs font-semibold', map[category])}>
      {category}
    </span>
  );
}
