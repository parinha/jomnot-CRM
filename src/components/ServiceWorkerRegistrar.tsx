'use client';

import { useEffect, useState } from 'react';

export default function ServiceWorkerRegistrar() {
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    function trackWaiting(reg: ServiceWorkerRegistration) {
      // Already waiting (e.g. page was open when deploy happened)
      if (reg.waiting) {
        setWaitingSW(reg.waiting);
        return;
      }

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          // A new SW finished installing and is now waiting
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingSW(reg.waiting);
          }
        });
      });
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        trackWaiting(reg);
        // Check for updates when user returns to the tab
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update();
        });
      })
      .catch(() => {});

    // When the SW takes control (after SKIP_WAITING), reload the page
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloading) {
        reloading = true;
        window.location.reload();
      }
    });
  }, []);

  function applyUpdate() {
    waitingSW?.postMessage('SKIP_WAITING');
  }

  if (!waitingSW) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[200] flex justify-center px-4"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
    >
      <div className="flex items-center gap-3 w-full max-w-sm bg-zinc-900/95 backdrop-blur-xl border border-white/15 rounded-2xl px-4 py-3 shadow-2xl">
        <div className="w-8 h-8 rounded-xl bg-[#FFC206]/15 text-[#FFC206] flex items-center justify-center shrink-0">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">Update available</p>
          <p className="text-xs text-white/45 mt-0.5">Tap to get the latest version</p>
        </div>
        <button
          onClick={applyUpdate}
          className="h-9 px-4 rounded-xl bg-[#FFC206] text-zinc-900 text-sm font-bold hover:bg-yellow-400 active:bg-yellow-500 transition shrink-0"
        >
          Update
        </button>
      </div>
    </div>
  );
}
