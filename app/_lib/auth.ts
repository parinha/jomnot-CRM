import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth'
import { app } from './firebase'

export const auth = getAuth(app)

// setPersistence is browser-only (uses localStorage)
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(console.error)
}

export const SESSION_KEY  = 'auth_login_at'
export const SESSION_DAYS = 30
