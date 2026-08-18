'use client';

import { useState, type FormEvent } from 'react';
import { useAuth, ApiError } from '@/lib/auth-context';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import type { Project } from '@/lib/types';

function suggestKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0]!.slice(0, 10).toUpperCase();
  return words
    .map((w) => w[0])
    .join('')
    .slice(0, 10)
    .toUpperCase();
}

export function CreateProjectDialog({
  organisationId,
  onClose,
  onCreated,
}: {
  organisationId: string;
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const { apiFetch } = useAuth();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (!keyTouched) setKey(suggestKey(value));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const project = await apiFetch<Project>('/projects', {
        method: 'POST',
        body: JSON.stringify({ organisationId, name, key, description: description || undefined }),
      });
      onCreated(project);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="create-project-title" className="mb-1 text-lg font-semibold text-slate-900">
          New project
        </h2>
        <p className="mb-5 text-sm text-slate-500">Projects group bug reports for one website or client.</p>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          {error && <ErrorBanner message={error} />}
          <TextField
            label="Project name"
            required
            autoFocus
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Client X Website"
          />
          <TextField
            label="Key"
            required
            hint="Shown next to every report from this project, e.g. WEB-1."
            value={key}
            onChange={(e) => {
              setKeyTouched(true);
              setKey(e.target.value.toUpperCase());
            }}
            maxLength={10}
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {submitting ? 'Creating…' : 'Create project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
