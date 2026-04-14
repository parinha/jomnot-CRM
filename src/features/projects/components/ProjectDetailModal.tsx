'use client';

import { useTransition } from 'react';
import type { Project, Client, Invoice } from '@/src/types';
import {
  ITEM_STATUS_CONFIG,
  ITEM_STATUS_NEXT,
  PROJECT_STATUS_CONFIG,
} from '@/src/config/statusConfig';
import { updateProjectItems } from '@/src/features/projects/actions/projectActions';

interface Props {
  projectId: string;
  onClose: () => void;
  projects: Project[];
  clients: Client[];
  invoices: Invoice[];
}

export default function ProjectDetailModal({
  projectId,
  onClose,
  projects,
  clients,
  invoices,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const project = projects.find((p) => p.id === projectId);
  const client = project ? clients.find((c) => c.id === project.clientId) : null;

  const doneCount = project ? project.items.filter((it) => it.status === 'done').length : 0;
  const totalItems = project ? project.items.length : 0;
  const pct = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0;
  const sc = project ? PROJECT_STATUS_CONFIG[project.status] : null;
  const linkedInvs = project
    ? project.invoiceIds.map((id) => invoices.find((i) => i.id === id)).filter(Boolean)
    : [];

  function cycleItem(itemId: string) {
    if (!project) return;
    const newItems = project.items.map((it) =>
      it.id !== itemId ? it : { ...it, status: ITEM_STATUS_NEXT[it.status] }
    );
    startTransition(async () => {
      await updateProjectItems(project.id, newItems);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-slate-900/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {!project ? (
          <div className="p-8 text-center text-white/40 text-sm">Project not found.</div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-white/[0.08] shrink-0">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg font-bold text-white">{project.name}</h2>
                  {sc && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.cls}`}>
                      {sc.label}
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/45 mt-0.5">
                  {client?.name ?? '—'}
                  {linkedInvs.length > 0 && (
                    <span className="text-white/30">
                      {' '}
                      · {linkedInvs.map((i) => i?.number).join(', ')}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition shrink-0"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              {/* Progress bar */}
              {totalItems > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-white/45">
                      {doneCount}/{totalItems} done
                    </span>
                    <span className="text-xs font-semibold text-white/70">{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-400' : 'bg-[#FFC206]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Scope items */}
              {project.items.length === 0 ? (
                <p className="text-sm text-white/35 text-center py-6">
                  No scope items in this project.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {project.items.map((item) => {
                    const cfg = ITEM_STATUS_CONFIG[item.status];
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] transition"
                      >
                        <button
                          onClick={() => cycleItem(item.id)}
                          disabled={isPending}
                          className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold transition hover:opacity-80 disabled:opacity-50 ${cfg.cls}`}
                          title="Click to cycle status"
                        >
                          {cfg.label}
                        </button>
                        <span
                          className={`text-sm flex-1 ${item.status === 'done' ? 'line-through text-white/30' : 'text-white/80'}`}
                        >
                          {item.description}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-white/[0.08] shrink-0">
              <p className="text-xs text-white/30">
                Click a status badge to cycle: To Do → In Progress → Done
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
