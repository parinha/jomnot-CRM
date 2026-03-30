import { storageGet, storageSet } from '@/app/_lib/storage'
import { STORAGE_KEYS } from '@/app/_config/constants'
import type { Project } from '@/app/dashboard/AppStore'

export function getProjects(): Project[] {
  return storageGet<Project[]>(STORAGE_KEYS.projects, [])
}

export function saveProjects(projects: Project[]): void {
  storageSet(STORAGE_KEYS.projects, projects)
}
