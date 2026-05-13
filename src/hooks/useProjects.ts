import type { Project, ProjectItem } from '@/src/types';
import { useProjectsContext } from '@/src/contexts/ProjectsContext';
import { deleteClientDoc, patchClientDoc } from '@/src/lib/firestoreService';

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
  async function upsert(project: Project): Promise<void> {
    // Keep API route: triggers server-side telegram notification on new project creation
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Failed to save project');
    }
  }

  async function remove(id: string): Promise<void> {
    await deleteClientDoc('projects', id);
  }

  async function updateItems(projectId: string, items: ProjectItem[]): Promise<void> {
    await patchClientDoc('projects', projectId, { items: items as unknown[] } as Record<
      string,
      unknown
    >);
  }

  async function updateKanbanPhase(projectId: string, kanbanPhase: string): Promise<void> {
    await patchClientDoc('projects', projectId, { kanbanPhase });
  }

  return { upsert, remove, updateItems, updateKanbanPhase };
}
