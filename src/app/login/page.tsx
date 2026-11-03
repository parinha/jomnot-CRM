'use client';

import { Receipt, WarningCircle } from '@phosphor-icons/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/src/components/AuthProvider';

function LoginForm() {
  const router = useRouter();
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email, password);
      router.replace('/dashboard');
    } catch {
      setError('Invalid email or password.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  const inputCls =
    'h-12 rounded-2xl border border-line bg-subtle px-4 text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-brand/40 focus:bg-surface focus:border-brand transition text-sm';

  return (
    <div className="min-h-dvh flex flex-col bg-brand">
      {/* Green hero */}
      <div
        className="flex flex-col items-center justify-center text-center px-6 pt-14 pb-12"
        style={{ paddingTop: 'max(3.5rem, calc(env(safe-area-inset-top, 0px) + 2rem))' }}
      >
        <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center shadow-float">
          <Receipt className="w-9 h-9 text-brand" weight="duotone" aria-hidden />
        </div>
        <h1 className="text-3xl font-semibold text-white mt-5">EasyInvoices24</h1>
        <p className="text-white/85 mt-1">Invoicing made simple</p>
      </div>

      {/* White sheet */}
      <div
        className="flex-1 bg-surface rounded-t-[32px] px-6 pt-8"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-ink">Welcome back 👋</h2>
            <p className="text-sm text-muted mt-1">Sign in to your studio</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-ink-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-ink-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputCls}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                <WarningCircle
                  weight="duotone"
                  className="w-5 h-5 text-red-600 shrink-0"
                  aria-hidden
                />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-3 h-13 rounded-full bg-brand text-white text-base font-semibold hover:bg-brand-hover active:bg-brand-dark disabled:opacity-50 transition shadow-brand"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}
