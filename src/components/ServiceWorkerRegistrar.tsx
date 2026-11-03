'use client';

import { ArrowClockwise } from '@phosphor-icons/react';
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
      <div className="flex items-center gap-3 w-full max-w-sm bg-surface rounded-2xl px-4 py-3 shadow-float">
        <div className="w-9 h-9 rounded-full bg-brand-soft text-brand-ink flex items-center justify-center shrink-0">
          <ArrowClockwise className="w-4 h-4" weight="bold" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink leading-tight">Update available</p>
          <p className="text-xs text-muted mt-0.5">Tap to get the latest version</p>
        </div>
        <button
          onClick={applyUpdate}
          className="h-9 px-4 rounded-full bg-brand text-on-brand text-sm font-semibold hover:bg-brand-hover active:bg-brand-dark transition shrink-0"
        >
          Update
        </button>
      </div>
    </div>
  );
}
