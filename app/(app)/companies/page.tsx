import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { CompaniesView } from './companies-view';
import type { CompanyRow, ProjectRow } from '@/types/database.types';

export const dynamic = 'force-dynamic';
export const revalidate = 10;
interface PageProps {
  searchParams: Promise<{ company?: string }>;
}

export default async function CompaniesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const selectedCompanyId = sp.company ? Number(sp.company) : null;

  const supabase = await createClient();

  // Fetch all companies + (if one is selected) its projects.
  const [companiesRes, projectsRes] = await Promise.all([
    supabase.from('companies').select('*').order('name', { ascending: true }),
    selectedCompanyId
      ? supabase
          .from('projects')
          .select('*')
          .eq('company_id', selectedCompanyId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as ProjectRow[], error: null }),
  ]);

  if (companiesRes.error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm">
        ⚠ Failed to load companies: {companiesRes.error.message}
      </div>
    );
  }

  const companies = (companiesRes.data ?? []) as CompanyRow[];
  const projects  = (projectsRes.data  ?? []) as ProjectRow[];

  // Default selection: first company if none chosen.
  const effectiveCompanyId = selectedCompanyId ?? companies[0]?.id ?? null;

  return (
    <Suspense>
      <CompaniesView
        companies={companies}
        projects={projects}
        selectedCompanyId={effectiveCompanyId as number | null}
      />
    </Suspense>
  );
}
