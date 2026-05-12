'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { onSnapshot, collection } from 'firebase/firestore';
import { db } from '@/src/lib/firebase-client';
import { fetchAll } from '@/src/lib/firestoreService';

type HasId = { id: string };

const CACHE_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Shared listener registry — one onSnapshot per collection, regardless of
// how many hook instances are mounted across different screens.
// ---------------------------------------------------------------------------

type DataCallback = (data: unknown[]) => void;

interface SharedSub {
  fireUnsub: (() => void) | null;
  latestData: unknown[];
  callbacks: Set<DataCallback>;
  visHandler: (() => void) | null;
}

const sharedSubs = new Map<string, SharedSub>();

function acquireShared(
  collectionName: string,
  defaultValue: unknown[],
  cb: DataCallback
): () => void {
  let sub = sharedSubs.get(collectionName);

  if (!sub) {
    const newSub: SharedSub = {
      fireUnsub: null,
      latestData: defaultValue,
      callbacks: new Set(),
      visHandler: null,
    };

    const ref = collection(db, collectionName);

    const connect = () => {
      if (newSub.fireUnsub) return;
      newSub.fireUnsub = onSnapshot(
        ref,
        (snap) => {
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          newSub.latestData = data.length > 0 ? data : defaultValue;
          newSub.callbacks.forEach((fn) => fn(newSub.latestData));
        },
        () => {}
      );
    };

    const disconnect = () => {
      newSub.fireUnsub?.();
      newSub.fireUnsub = null;
    };

    newSub.visHandler = () => {
      if (document.hidden) disconnect();
      else connect();
    };
    document.addEventListener('visibilitychange', newSub.visHandler);
    connect();
    sharedSubs.set(collectionName, newSub);
    sub = newSub;
  }

  sub.callbacks.add(cb);
  if (sub.latestData.length > 0) cb(sub.latestData);

  return () => {
    const s = sharedSubs.get(collectionName);
    if (!s) return;
    s.callbacks.delete(cb);
    if (s.callbacks.size === 0) {
      s.fireUnsub?.();
      if (s.visHandler) document.removeEventListener('visibilitychange', s.visHandler);
      sharedSubs.delete(collectionName);
    }
  };
}

// ---------------------------------------------------------------------------

/**
 * Session-cache-first hook with Firestore sync.
 *
 * - Cache hit (< 5 min old): no network call, serve from sessionStorage.
 * - Cache miss / stale: fetch from Firestore client SDK.
 * - liveSync: join a shared onSnapshot listener — multiple instances on the
 *   same collection share a single Firestore subscription.
 *
 * Writes happen through existing API routes (server-side Admin SDK).
 * onSnapshot picks up those writes automatically, keeping state in sync.
 */
export function useFirestoreCache<T extends HasId>(
  cacheKey: string,
  collectionName: string,
  defaultValue: T[],
  options?: { liveSync?: boolean }
): [T[], (v: T[] | ((prev: T[]) => T[])) => void, boolean] {
  const liveSync = options?.liveSync ?? false;

  const [items, setItemsState] = useState<T[]>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw !== null) return JSON.parse(raw) as T[];
    } catch {}
    return defaultValue;
  });

  const [loading, setLoading] = useState(false);
  const prevRef = useRef<T[]>(items);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw !== null) prevRef.current = JSON.parse(raw) as T[];
    } catch {}

    if (liveSync) {
      setLoading(true);

      const onData = (data: unknown[]) => {
        const typed = data as T[];
        setItemsState(typed);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(typed));
          sessionStorage.setItem(`${cacheKey}_ts`, String(Date.now()));
        } catch {}
        prevRef.current = typed;
        setLoading(false);
      };

      return acquireShared(collectionName, defaultValue as unknown[], onData);
    }

    const tsKey = `${cacheKey}_ts`;
    const cached = sessionStorage.getItem(cacheKey);
    const ts = sessionStorage.getItem(tsKey);
    const cacheAge = ts ? Date.now() - Number(ts) : Infinity;
    if (cached !== null && cacheAge < CACHE_TTL_MS) return;

    setLoading(true);
    fetchAll<T>(collectionName)
      .then((fetched) => {
        const data = fetched.length > 0 ? fetched : defaultValue;
        setItemsState(data);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
          sessionStorage.setItem(tsKey, String(Date.now()));
        } catch {}
        prevRef.current = data;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setItems = useCallback(
    (v: T[] | ((prev: T[]) => T[])) => {
      setItemsState((prev) => {
        const next = typeof v === 'function' ? v(prev) : v;
        const tsKey = `${cacheKey}_ts`;
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(next));
          sessionStorage.setItem(tsKey, String(Date.now()));
        } catch {}
        prevRef.current = next;
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collectionName]
  );

  return [items, setItems, loading];
}
