import type { Project, ProjectItem } from '@/src/types';
import { useProjectsContext } from '@/src/contexts/ProjectsContext';
import { upsertDoc, deleteDoc, patchDoc } from '@/src/lib/client/firestore';

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
    await upsertDoc('projects', project.id, project);
  }

  async function remove(id: string): Promise<void> {
    await deleteDoc('projects', id);
  }

  async function updateItems(projectId: string, items: ProjectItem[]): Promise<void> {
    await patchDoc('projects', projectId, { items: items as unknown[] } as Record<string, unknown>);
  }

  return { upsert, remove, updateItems };
}
