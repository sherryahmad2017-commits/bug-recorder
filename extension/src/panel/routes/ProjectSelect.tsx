import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api-client';
import { ApiError } from '../../lib/api-error';
import { getActiveProjectId, setActiveProjectId } from '../../lib/active-project-store';
import type { CurrentUser, Project } from '../../lib/types';
import { Spinner } from '../components/Spinner';
import { ErrorMessage } from '../components/ErrorMessage';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; projects: Project[] };

export function ProjectSelect({ user }: { user: CurrentUser }) {
  const [organisationId, setOrganisationId] = useState(user.memberships[0]?.organisation.id ?? '');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);

  useEffect(() => {
    getActiveProjectId().then(setActiveProjectIdState);
  }, []);

  const loadProjects = useCallback(() => {
    if (!organisationId) return;
    setState({ status: 'loading' });
    apiFetch<Project[]>(`/projects?organisationId=${organisationId}`)
      .then((projects) => setState({ status: 'ready', projects }))
      .catch((err) => setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Could not load projects.' }));
  }, [organisationId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  async function handleSelect(project: Project) {
    await setActiveProjectId(project.id);
    setActiveProjectIdState(project.id);
  }

  const selectedProject = state.status === 'ready' ? state.projects.find((p) => p.id === activeProjectId) : undefined;

  return (
    <div className="rf-main">
      <div className="rf-field">
        <label className="rf-label" htmlFor="org-select">
          Organisation
        </label>
        <select
          id="org-select"
          className="rf-select"
          value={organisationId}
          onChange={(e) => setOrganisationId(e.target.value)}
        >
          {user.memberships.map((m) => (
            <option key={m.organisation.id} value={m.organisation.id}>
              {m.organisation.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h2 className="rf-title" style={{ fontSize: 14 }}>
          Choose a project
        </h2>
        <p className="rf-subtitle">Bug reports you create will be added to this project.</p>
      </div>

      {state.status === 'loading' && <Spinner label="Loading projects…" />}
      {state.status === 'error' && <ErrorMessage message={state.message} />}
      {state.status === 'ready' && state.projects.length === 0 && (
        <div className="rf-empty">No projects yet. Create one from the ReproFlow dashboard.</div>
      )}
      {state.status === 'ready' && state.projects.length > 0 && (
        <div className="rf-project-list">
          {state.projects.map((project) => {
            const isSelected = project.id === activeProjectId;
            return (
              <button
                key={project.id}
                type="button"
                className={`rf-project-card${isSelected ? ' is-selected' : ''}`}
                onClick={() => handleSelect(project)}
                aria-pressed={isSelected}
              >
                <div>
                  <span className="rf-project-key">{project.key}</span>
                  <p className="rf-project-name">{project.name}</p>
                </div>
                {isSelected && (
                  <span className="rf-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedProject && (
        <div className="rf-selected-banner">
          <strong>{selectedProject.name}</strong> is your active project. The &ldquo;Report a bug&rdquo; capture flow
          (screenshot, recording, technical context) arrives in the next update — this build covers sign-in and
          project selection only.
        </div>
      )}
    </div>
  );
}
