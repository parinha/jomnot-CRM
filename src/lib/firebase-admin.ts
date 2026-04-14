import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

type Db = ReturnType<typeof getFirestore>;

function createDb(): Db {
  const apps = getApps();
  const app =
    apps.length > 0
      ? apps[0]
      : (() => {
          const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
          if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
          return initializeApp({ credential: cert(JSON.parse(sa)) });
        })();
  return getFirestore(app);
}

// Lazy proxy — initialization (and any missing-env error) is deferred until
// the first database operation. This prevents build-time failures when
// FIREBASE_SERVICE_ACCOUNT is absent.
let _db: Db | undefined;

export const adminDb: Db = new Proxy({} as Db, {
  get(_t, p) {
    _db ??= createDb();
    return (_db as unknown as Record<string | symbol, unknown>)[p];
  },
});
