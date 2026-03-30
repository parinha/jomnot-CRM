import { storageGet, storageSet } from '@/app/_lib/storage'
import { STORAGE_KEYS, DEFAULT_SCOPES } from '@/app/_config/constants'

export function getScopes(): string[] {
  return storageGet<string[]>(STORAGE_KEYS.scopes, DEFAULT_SCOPES)
}

export function saveScopes(scopes: string[]): void {
  storageSet(STORAGE_KEYS.scopes, scopes)
}
