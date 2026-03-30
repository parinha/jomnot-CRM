'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { auth, SESSION_KEY, SESSION_DAYS } from '@/app/_lib/auth'

interface AuthCtx {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        // Enforce 30-day session expiry
        const loginAt = localStorage.getItem(SESSION_KEY)
        if (loginAt) {
          const days = (Date.now() - parseInt(loginAt)) / (1000 * 60 * 60 * 24)
          if (days > SESSION_DAYS) {
            firebaseSignOut(auth)
            localStorage.removeItem(SESSION_KEY)
            setUser(null)
            setLoading(false)
            return
          }
        }
      }
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
    localStorage.setItem(SESSION_KEY, String(Date.now()))
  }

  async function signOut() {
    await firebaseSignOut(auth)
    localStorage.removeItem(SESSION_KEY)
  }

  return <Ctx.Provider value={{ user, loading, signIn, signOut }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
