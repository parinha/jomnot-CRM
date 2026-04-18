'use client';

import { useState } from 'react';
import { useSendProjectsTelegram } from '@/src/hooks/useTelegram';

export default function TelegramProjectsButton({ compact }: { compact?: boolean }) {
  const { sendAll } = useSendProjectsTelegram();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');

  async function handleSend() {
    setLoading(true);
    setStatus('idle');
    const result = await sendAll();
    setLoading(false);
    if (result.ok) {
      setStatus('ok');
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      alert(result.error ?? 'Failed to send.');
      setStatus('err');
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={loading}
      title="Send project status to Telegram"
      className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-sky-400/70 hover:bg-sky-500/10 hover:text-sky-300 active:bg-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition w-full ${compact ? 'justify-center' : ''}`}
    >
      {loading ? (
        <>
          <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {!compact && 'Sending…'}
        </>
      ) : status === 'ok' ? (
        <>
          <svg
            className="w-4 h-4 text-green-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {!compact && 'Sent!'}
        </>
      ) : (
        <>
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
          {!compact && 'Telegram'}
        </>
      )}
    </button>
  );
}
