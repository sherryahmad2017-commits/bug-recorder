import type { Project } from '@/lib/types';

export function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md">
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-700">
            {project.key}
          </span>
          <h3 className="text-sm font-semibold text-slate-900">{project.name}</h3>
        </div>
        {project.description && <p className="mt-1 text-sm text-slate-500">{project.description}</p>}
      </div>
    </div>
  );
}
