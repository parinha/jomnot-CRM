import { useSWRConfig } from 'swr';
import { ApiError } from '@/src/lib/swr-fetcher';
import type { Project, ProjectItem } from '@/src/types';
import { useProjectsContext } from '@/src/contexts/ProjectsContext';

export function useProjects() {
  const { projects, loading } = useProjectsContext();
  return {
    data: projects,
    isLoading: loading,
    isError: false,
    error: null,
    mutate: async () => {},
  };
}

export function useProjectMutations() {
  const { mutate } = useSWRConfig();

  async function upsert(project: Project): Promise<void> {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? 'Failed to save project', res.status);
    }
    await mutate('/api/projects');
  }

  async function remove(id: string): Promise<void> {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? 'Failed to delete project', res.status);
    }
    await mutate('/api/projects');
  }

  async function updateItems(projectId: string, items: ProjectItem[]): Promise<void> {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? 'Failed to update project', res.status);
    }
    await mutate('/api/projects');
  }

  async function updateKanbanPhase(projectId: string, kanbanPhase: string): Promise<void> {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kanbanPhase }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? 'Failed to update project', res.status);
    }
    await mutate('/api/projects');
  }

  return { upsert, remove, updateItems, updateKanbanPhase };
}
