'use client';

import { useEffect, useRef } from 'react';
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
  pos: { top: number; left: number };
  onClose: () => void;
  onTogglePhase: (key: keyof ProjectPhases) => void;
  onToggleItem: (itemId: string) => void;
}

export default function ProgressPopover({
  project,
  pos,
  onClose,
  onTogglePhase,
  onToggleItem,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Element;
      if (ref.current?.contains(target)) return;
      if (target.closest('[data-progress-trigger]')) return;
      onClose();
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  const delivs = project.items ?? [];

  return createPortal(
    <div
      ref={ref}
      style={{ top: pos.top, left: pos.left }}
      className="fixed z-[9999] w-56 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-3 flex flex-col gap-3"
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-white/30 hover:text-white/70 transition"
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
    </div>,
    document.body
  );
}
