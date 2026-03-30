import { storageGet, storageSet } from '@/app/_lib/storage'
import { STORAGE_KEYS } from '@/app/_config/constants'
import type { Client } from '@/app/dashboard/AppStore'

export function getClients(): Client[] {
  return storageGet<Client[]>(STORAGE_KEYS.clients, [])
}

export function saveClients(clients: Client[]): void {
  storageSet(STORAGE_KEYS.clients, clients)
}
