'use client';

import { Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import ModalShell from '@/src/components/ModalShell';
import { auth } from '@/src/lib/auth';

interface Props {
  title: string;
  description?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDeleteModal({ title, description, onConfirm, onClose }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (!password.trim()) {
      setError('Password is required.');
      return;
    }
    const user = auth.currentUser;
    if (!user?.email) {
      setError('No authenticated user found.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      onConfirm();
      onClose();
    } catch {
      setError('Incorrect password. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="p-5 flex flex-col gap-4">
        {/* Icon + title */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-red-50 border border-red-200 flex items-center justify-center shrink-0 mt-0.5">
            <Trash className="w-4 h-4 text-red-600" weight="duotone" aria-hidden />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink">{title}</h2>
            <p className="text-xs text-muted mt-0.5">
              {description ?? 'This action cannot be undone.'}
            </p>
          </div>
        </div>

        {/* Password field */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-2">Confirm your password</label>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm();
            }}
            placeholder="••••••••"
            className="h-11 rounded-xl border border-line bg-subtle px-4 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition w-full"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-full border border-line-strong text-sm font-medium text-ink-2 hover:bg-black/[0.04] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="flex-1 h-11 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition"
          >
            {busy ? 'Verifying…' : 'Delete'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
