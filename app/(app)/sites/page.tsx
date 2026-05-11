import { createClient } from '@/lib/supabase/server';
import { SitesView } from './sites-view';

export const dynamic = 'force-dynamic';

interface SiteWithProject {
  id: number;
  name: string;
  type: 'Main Store' | 'Site' | 'Subcontractor' | 'Individual';
  description: string | null;
  project_id: number | null;
  created_at: string;
  // Pulled in via foreign-key embed below.
  projects: { id: number; name: string; company_id: number } | null;
}

interface ProjectOption {
  id: number;
  name: string;
  company_id: number;
}

interface CompanyMap {
  [id: number]: string;
}

export default async function SitesPage() {
  const supabase = await createClient();

  const [sitesRes, projectsRes, companiesRes] = await Promise.all([
    // Embed the linked project so each site row knows its project name.
    supabase
      .from('sites')
      .select('id, name, type, description, project_id, created_at, projects(id, name, company_id)')
      .order('name', { ascending: true }),
    supabase
      .from('projects')
      .select('id, name, company_id')
      .order('name', { ascending: true }),
    supabase.from('companies').select('id, name'),
  ]);

  if (sitesRes.error) {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-sm">
        ⚠ Failed to load sites: {sitesRes.error.message}
      </div>
    );
  }

  const sites = (sitesRes.data ?? []) as unknown as SiteWithProject[];
  const projects = (projectsRes.data ?? []) as unknown as ProjectOption[];
  const companyMap: CompanyMap = {};
  for (const c of (companiesRes.data ?? []) as unknown as { id: number; name: string }[]) {
    companyMap[c.id] = c.name;
  }

  return <SitesView sites={sites} projects={projects} companyMap={companyMap} />;
}
