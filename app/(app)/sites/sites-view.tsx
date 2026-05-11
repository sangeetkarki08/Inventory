'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, MapPin, Search, Filter } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { SiteForm } from './site-form';
import { deleteSite } from '@/lib/actions/sites';
import { cn } from '@/lib/utils';

type SiteType = 'Main Store' | 'Site' | 'Subcontractor' | 'Individual';

interface SiteRow {
  id: number;
  name: string;
  type: SiteType;
  description: string | null;
  project_id: number | null;
  created_at: string;
  projects: { id: number; name: string; company_id: number } | null;
}

interface ProjectOption {
  id: number;
  name: string;
  company_id: number;
}

type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; row: SiteRow };

const TYPE_FILTER_OPTIONS = [
  { value: 'all',           label: 'All Types' },
  { value: 'Main Store',    label: 'Main Store' },
  { value: 'Site',          label: 'Site' },
  { value: 'Subcontractor', label: 'Subcontractor' },
  { value: 'Individual',    label: 'Individual' },
];

export function SitesView({
  sites,
  projects,
  companyMap,
}: {
  sites: SiteRow[];
  projects: ProjectOption[];
  companyMap: Record<number, string>;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sites.filter((s) => {
      if (typeFilter !== 'all' && s.type !== typeFilter) return false;
      if (projectFilter !== 'all') {
        if (projectFilter === 'none' && s.project_id != null) return false;
        if (projectFilter !== 'none' && String(s.project_id) !== projectFilter) return false;
      }
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sites, search, typeFilter, projectFilter]);

  function handleDelete(s: SiteRow) {
    if (!confirm(`Delete site "${s.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteSite(s.id);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  // Group sites by type for the summary cards.
  const counts = useMemo(() => {
    const c: Record<SiteType, number> = {
      'Main Store': 0,
      Site: 0,
      Subcontractor: 0,
      Individual: 0,
    };
    for (const s of sites) c[s.type]++;
    return c;
  }, [sites]);

  const projectFilterOptions = [
    { value: 'all',  label: 'All Projects' },
    { value: 'none', label: 'No Project' },
    ...projects.map((p) => ({ value: String(p.id), label: p.name })),
  ];

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sites &amp; Locations</h1>
          <p className="text-muted text-sm mt-1">
            Physical locations where stock lives, moves to, or is held by
          </p>
        </div>
        <Button onClick={() => setModal({ kind: 'create' })}>
          <Plus size={16} /> New Site
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <CountCard label="Main Stores" value={counts['Main Store']} accent="info" />
        <CountCard label="Sites" value={counts.Site} accent="success" />
        <CountCard label="Subcontractors" value={counts.Subcontractor} accent="amber" />
        <CountCard label="Individuals" value={counts.Individual} accent="muted" />
      </div>

      {/* Filters */}
      <div className="bg-panel border border-border rounded-2xl p-4 mb-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by site name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <Filter size={16} className="text-muted" />
          <div className="w-44">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={TYPE_FILTER_OPTIONS}
            />
          </div>
          <div className="w-52">
            <Select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              options={projectFilterOptions}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-panel border border-border rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <MapPin className="mx-auto mb-3 text-muted" size={32} />
            <p className="text-sm text-muted">
              {sites.length === 0
                ? 'No sites yet. Click New Site to add your first location.'
                : 'No sites match your filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg/40 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Site</th>
                  <th className="px-5 py-3 text-left font-medium">Type</th>
                  <th className="px-5 py-3 text-left font-medium">Project</th>
                  <th className="px-5 py-3 text-left font-medium">Company</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-t border-border/40 hover:bg-border/10">
                    <td className="px-5 py-3">
                      <div className="font-medium">{s.name}</div>
                      {s.description && (
                        <div className="text-xs text-muted truncate max-w-md">{s.description}</div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <TypeBadge type={s.type} />
                    </td>
                    <td className="px-5 py-3 text-muted">{s.projects?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-muted">
                      {s.projects?.company_id != null ? companyMap[s.projects.company_id] ?? '—' : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => setModal({ kind: 'edit', row: s })}
                          className="p-1.5 rounded hover:bg-border/50 transition"
                          title="Edit"
                        >
                          <Pencil size={14} className="text-muted" />
                        </button>
                        <button
                          onClick={() => handleDelete(s)}
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

      {/* Modal */}
      <Modal
        open={modal.kind !== 'none'}
        onClose={() => setModal({ kind: 'none' })}
        title={modal.kind === 'edit' ? 'Edit Site' : 'New Site'}
        size="md"
      >
        {modal.kind !== 'none' && (
          <SiteForm
            initial={modal.kind === 'edit' ? modal.row : null}
            projects={projects}
            companyMap={companyMap}
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

function TypeBadge({ type }: { type: SiteType }) {
  const map: Record<SiteType, string> = {
    'Main Store':    'bg-info/15 text-info',
    Site:            'bg-success/15 text-success',
    Subcontractor:   'bg-accent/15 text-accent',
    Individual:      'bg-border/40 text-muted',
  };
  return (
    <span className={cn('inline-block px-2 py-0.5 rounded-md text-xs font-semibold', map[type])}>
      {type}
    </span>
  );
}
