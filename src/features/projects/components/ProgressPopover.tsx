'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Project, ProjectPhases } from '@/src/types';

const PHASES: { key: keyof ProjectPhases; label: string }[] = [
  { key: 'filming', label: 'Filming' },
  { key: 'roughCut', label: 'Rough Cut' },
  { key: 'draft', label: 'Draft/VO' },
  { key: 'master', label: 'Master' },
  { key: 'delivered', label: 'Done' },
];

interface Props {
  project: Project;
  onClose: () => void;
  onTogglePhase: (key: keyof ProjectPhases) => void;
  onToggleItem: (itemId: string) => void;
}

export default function ProgressPopover({ project, onClose, onTogglePhase, onToggleItem }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const delivs = project.items ?? [];

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998] bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="fixed z-[9999] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 pr-1">
          <p className="text-xs font-semibold text-white/70 leading-snug line-clamp-2">
            {project.name}
          </p>
          <button
            onClick={onClose}
            className="shrink-0 text-white/30 hover:text-white/70 transition mt-0.5"
            aria-label="Close"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Phases */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-1.5">
            Phases
          </p>
          <div className="flex flex-col gap-1">
            {PHASES.map((ph) => {
              const checked = project.phases?.[ph.key] ?? false;
              return (
                <button
                  key={ph.key}
                  type="button"
                  onClick={() => onTogglePhase(ph.key)}
                  className="flex items-center gap-2 text-left w-full group/item"
                >
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-white/20 group-hover/item:border-white/40'}`}
                  >
                    {checked && (
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span
                    className={`text-xs transition ${checked ? 'line-through text-white/30' : 'text-white/70 group-hover/item:text-white/90'}`}
                  >
                    {ph.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Deliverables */}
        {delivs.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-1.5">
              Deliverables
            </p>
            <div className="flex flex-col gap-1">
              {delivs.map((item) => {
                const done = item.status === 'done';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggleItem(item.id)}
                    className="flex items-center gap-2 text-left w-full group/item"
                  >
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition ${done ? 'bg-violet-500 border-violet-500' : 'border-white/20 group-hover/item:border-white/40'}`}
                    >
                      {done && (
                        <svg
                          className="w-2.5 h-2.5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span
                      className={`text-xs transition leading-tight ${done ? 'line-through text-white/30' : 'text-white/70 group-hover/item:text-white/90'}`}
                    >
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
