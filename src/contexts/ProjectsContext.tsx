'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Project } from '@/src/types';
import { useFirestoreCache } from '@/src/hooks/useFirestoreCache';

interface ProjectsCtx {
  projects: Project[];
  setProjects: (v: Project[] | ((prev: Project[]) => Project[])) => void;
  loading: boolean;
}

const Ctx = createContext<ProjectsCtx | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects, loading] = useFirestoreCache<Project>(
    'ei24_projects',
    'projects',
    [],
    { liveSync: true }
  );

  return <Ctx.Provider value={{ projects, setProjects, loading }}>{children}</Ctx.Provider>;
}

export function useProjectsContext(): ProjectsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProjectsContext must be used within ProjectsProvider');
  return ctx;
}
