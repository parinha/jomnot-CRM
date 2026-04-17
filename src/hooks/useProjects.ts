import useSWR, { useSWRConfig } from 'swr';
import { fetcher, ApiError } from '@/src/lib/swr-fetcher';
import type { Project, ProjectItem, ProjectPhases } from '@/src/types';

const projectFetcher = fetcher as (url: string) => Promise<Project[]>;

export function useProjects() {
  const { data, error, isLoading, mutate } = useSWR<Project[]>('/api/projects', projectFetcher);
  return {
    data: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
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

  async function updatePhases(projectId: string, phases: ProjectPhases): Promise<void> {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phases }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? 'Failed to update project', res.status);
    }
    await mutate('/api/projects');
  }

  return { upsert, remove, updateItems, updatePhases };
}
