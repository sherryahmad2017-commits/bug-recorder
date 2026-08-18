// The chosen project persists across panel opens so returning to report
// another bug in the same project doesn't require re-selecting it every time.
// Phase 2's report flow reads this value as the default project.

const ACTIVE_PROJECT_KEY = 'reproflow_active_project_id';

export async function getActiveProjectId(): Promise<string | null> {
  const result = await chrome.storage.local.get(ACTIVE_PROJECT_KEY);
  return (result[ACTIVE_PROJECT_KEY] as string | undefined) ?? null;
}

export async function setActiveProjectId(projectId: string): Promise<void> {
  await chrome.storage.local.set({ [ACTIVE_PROJECT_KEY]: projectId });
}
