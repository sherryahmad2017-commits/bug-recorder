'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useAppData } from '@/lib/app-data-context';
import { hasMinRole } from '@/lib/roles';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import type { Project } from '@/lib/types';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; projects: Project[] };

export default function ProjectsPage() {
  const { apiFetch } = useAuth();
  const { loading: orgLoading, error: orgError, currentMembership } = useAppData();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [dialogOpen, setDialogOpen] = useState(false);

  const organisationId = currentMembership?.organisation.id;

  const loadProjects = useCallback(() => {
    if (!organisationId) return;
    setState({ status: 'loading' });
    apiFetch<Project[]>(`/projects?organisationId=${organisationId}`)
      .then((projects) => setState({ status: 'ready', projects }))
      .catch(() => setState({ status: 'error', message: 'Could not load projects.' }));
  }, [apiFetch, organisationId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  if (orgLoading) return <Spinner label="Loading workspace…" />;
  if (orgError) return <ErrorBanner message={orgError} />;
  if (!currentMembership) return <Spinner label="Switching organisation…" />;

  const canCreateProject = hasMinRole(currentMembership.role, 'admin');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500">{currentMembership.organisation.name}</p>
        </div>
        {canCreateProject && <Button onClick={() => setDialogOpen(true)}>New project</Button>}
      </div>

      {state.status === 'loading' && <Spinner label="Loading projects…" />}
      {state.status === 'error' && <ErrorBanner message={state.message} onRetry={loadProjects} />}
      {state.status === 'ready' && state.projects.length === 0 && (
        <EmptyState
          title="No projects yet"
          description={
            canCreateProject
              ? 'Create a project for each website or client you want to collect bug reports for.'
              : 'Ask an admin to create a project so you can start reporting bugs here.'
          }
          action={canCreateProject ? <Button onClick={() => setDialogOpen(true)}>New project</Button> : undefined}
        />
      )}
      {state.status === 'ready' && state.projects.length > 0 && (
        <div className="flex flex-col gap-3">
          {state.projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {dialogOpen && organisationId && (
        <CreateProjectDialog
          organisationId={organisationId}
          onClose={() => setDialogOpen(false)}
          onCreated={(project) => {
            setDialogOpen(false);
            setState((prev) => (prev.status === 'ready' ? { status: 'ready', projects: [...prev.projects, project] } : prev));
          }}
        />
      )}
    </div>
  );
}
