'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Pencil, Trash2, Building2, Briefcase, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { CompanyForm } from './company-form';
import { ProjectForm } from './project-form';
import { deleteCompany, deleteProject } from '@/lib/actions/organization';
import { cn } from '@/lib/utils';
import type { CompanyRow, ProjectRow, ProjectStatus } from '@/types/database.types';

type Modal =
  | { kind: 'none' }
  | { kind: 'company'; mode: 'create' } | { kind: 'company'; mode: 'edit'; row: CompanyRow }
  | { kind: 'project'; mode: 'create' } | { kind: 'project'; mode: 'edit'; row: ProjectRow };

export function CompaniesView({
  companies,
  projects,
  selectedCompanyId,
}: {
  companies: CompanyRow[];
  projects: ProjectRow[];
  selectedCompanyId: number | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modal, setModal] = useState<Modal>({ kind: 'none' });
  const [isPending, startTransition] = useTransition();

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  function selectCompany(id: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('company', id.toString());
    router.push(`/companies?${params.toString()}`);
  }

  function handleDeleteCompany(c: CompanyRow) {
    if (!confirm(`Delete company "${c.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteCompany(c.id as number);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  function handleDeleteProject(p: ProjectRow) {
    if (!confirm(`Delete project "${p.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteProject(p.id as number);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Companies &amp; Projects</h1>
          <p className="text-muted text-sm mt-1">
            Manage your organizations and the construction projects that hang off them
          </p>
        </div>
        <Button onClick={() => setModal({ kind: 'company', mode: 'create' })}>
          <Plus size={16} /> New Company
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6">
        {/* ─── Companies list (left) ────────────────────────────────────── */}
        <div className="bg-panel border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Building2 size={16} className="text-muted" />
            <h2 className="text-sm font-semibold">Companies</h2>
            <span className="ml-auto text-xs text-muted">{companies.length}</span>
          </div>
          {companies.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">
              No companies yet. Click <strong>New Company</strong> to start.
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {companies.map((c) => (
                <li key={c.id} className="group">
                  <button
                    onClick={() => selectCompany(c.id as number)}
                    className={cn(
                      'w-full text-left px-4 py-3 flex items-center gap-2 transition',
                      c.id === selectedCompanyId
                        ? 'bg-accent/10 border-l-2 border-l-accent'
                        : 'hover:bg-border/30 border-l-2 border-l-transparent',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      {c.contact_email && (
                        <div className="text-xs text-muted truncate">{c.contact_email}</div>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-muted shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ─── Selected company + projects (right) ─────────────────────── */}
        <div>
          {selectedCompany ? (
            <>
              {/* Company header card */}
              <div className="bg-panel border border-border rounded-2xl p-5 mb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold mb-1">{selectedCompany.name}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted">
                      {selectedCompany.contact_email && (
                        <div>📧 {selectedCompany.contact_email}</div>
                      )}
                      {selectedCompany.contact_phone && (
                        <div>📞 {selectedCompany.contact_phone}</div>
                      )}
                      {selectedCompany.address && (
                        <div className="sm:col-span-2">📍 {selectedCompany.address}</div>
                      )}
                    </div>
                    {selectedCompany.notes && (
                      <p className="mt-3 text-sm text-text/80">{selectedCompany.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      onClick={() => setModal({ kind: 'company', mode: 'edit', row: selectedCompany })}
                    >
                      <Pencil size={14} /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleDeleteCompany(selectedCompany)}
                      disabled={isPending}
                    >
                      <Trash2 size={14} className="text-danger" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Projects under this company */}
              <div className="bg-panel border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase size={16} className="text-muted" />
                    <h3 className="font-semibold">Projects</h3>
                    <span className="text-xs text-muted">({projects.length})</span>
                  </div>
                  <Button onClick={() => setModal({ kind: 'project', mode: 'create' })}>
                    <Plus size={14} /> New Project
                  </Button>
                </div>

                {projects.length === 0 ? (
                  <div className="p-12 text-center">
                    <Briefcase className="mx-auto mb-3 text-muted" size={32} />
                    <p className="text-sm text-muted">
                      No projects yet for this company.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-bg/40 text-xs uppercase tracking-wider text-muted">
                      <tr>
                        <th className="px-5 py-3 text-left font-medium">Project</th>
                        <th className="px-5 py-3 text-left font-medium">Status</th>
                        <th className="px-5 py-3 text-left font-medium">Start</th>
                        <th className="px-5 py-3 text-left font-medium">End</th>
                        <th className="px-5 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p) => (
                        <tr key={p.id} className="border-t border-border/40 hover:bg-border/10">
                          <td className="px-5 py-3">
                            <div className="font-medium">{p.name}</div>
                            {p.description && (
                              <div className="text-xs text-muted truncate max-w-md">
                                {p.description}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="px-5 py-3 text-muted">{p.start_date ?? '—'}</td>
                          <td className="px-5 py-3 text-muted">{p.end_date ?? '—'}</td>
                          <td className="px-5 py-3 text-right">
                            <div className="inline-flex gap-1">
                              <button
                                onClick={() => setModal({ kind: 'project', mode: 'edit', row: p })}
                                className="p-1.5 rounded hover:bg-border/50 transition"
                                title="Edit"
                              >
                                <Pencil size={14} className="text-muted" />
                              </button>
                              <button
                                onClick={() => handleDeleteProject(p)}
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
                )}
              </div>
            </>
          ) : (
            <div className="bg-panel border border-border rounded-2xl p-12 text-center">
              <Building2 className="mx-auto mb-3 text-muted" size={36} />
              <p className="text-muted">
                {companies.length === 0
                  ? 'Create your first company to get started.'
                  : 'Select a company from the list to view its projects.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Modals ──────────────────────────────────────────────────────── */}
      <Modal
        open={modal.kind === 'company'}
        onClose={() => setModal({ kind: 'none' })}
        title={modal.kind === 'company' && modal.mode === 'edit' ? 'Edit Company' : 'New Company'}
        size="md"
      >
        {modal.kind === 'company' && (
          <CompanyForm
            initial={modal.mode === 'edit' ? modal.row : null}
            onDone={() => {
              setModal({ kind: 'none' });
              router.refresh();
            }}
          />
        )}
      </Modal>

      <Modal
        open={modal.kind === 'project'}
        onClose={() => setModal({ kind: 'none' })}
        title={modal.kind === 'project' && modal.mode === 'edit' ? 'Edit Project' : 'New Project'}
        size="md"
      >
        {modal.kind === 'project' && selectedCompany && (
          <ProjectForm
            companyId={selectedCompany.id as number}
            initial={modal.mode === 'edit' ? modal.row : null}
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

function StatusBadge({ status }: { status: ProjectStatus }) {
  const map: Record<ProjectStatus, string> = {
    Active:    'bg-success/15 text-success',
    'On Hold': 'bg-accent/15 text-accent',
    Completed: 'bg-info/15 text-info',
    Cancelled: 'bg-danger/15 text-danger',
  };
  return (
    <span className={cn('inline-block px-2 py-0.5 rounded-md text-xs font-semibold', map[status])}>
      {status}
    </span>
  );
}
