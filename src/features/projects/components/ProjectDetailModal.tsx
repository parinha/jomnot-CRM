'use client';

import { useTransition } from 'react';
import { PROJECT_STATUS_CONFIG } from '@/src/config/statusConfig';
import { useProjects, useProjectMutations } from '@/src/hooks/useProjects';
import { useClients } from '@/src/hooks/useClients';
import { useInvoices } from '@/src/hooks/useInvoices';
import type { ProjectPhases } from '@/src/types';
import { PHASES } from '@/src/config/constants';

interface Props {
  projectId: string;
  onClose: () => void;
}

export default function ProjectDetailModal({ projectId, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const { data: projects } = useProjects();
  const { data: clients } = useClients();
  const { data: invoices } = useInvoices();
  const { updatePhases } = useProjectMutations();

  const project = projects.find((p) => p.id === projectId);
  const client = project ? clients.find((c) => c.id === project.clientId) : null;
  const linkedInvs = project
    ? project.invoiceIds.map((id) => invoices.find((i) => i.id === id)).filter(Boolean)
    : [];

  const sc = project ? PROJECT_STATUS_CONFIG[project.status] : null;
  const done = project ? PHASES.filter((p) => project.phases?.[p.key]).length : 0;

  function togglePhase(key: keyof ProjectPhases) {
    if (!project) return;
    const current = project.phases?.[key] ?? false;
    const newPhases: ProjectPhases = {
      filming: false,
      roughCut: false,
      draft: false,
      master: false,
      delivered: false,
      ...project.phases,
      [key]: !current,
    };
    startTransition(async () => {
      await updatePhases(project.id, newPhases);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-slate-900/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
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
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-white/45">
                    {done}/{PHASES.length} phases done
                  </span>
                  <span className="text-xs font-semibold text-white/70">
                    {Math.round((done / PHASES.length) * 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${done === PHASES.length ? 'bg-green-400' : 'bg-[#FFC206]'}`}
                    style={{ width: `${Math.round((done / PHASES.length) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Phase list */}
              <div className="flex flex-col gap-2">
                {PHASES.map((phase) => {
                  const checked = project.phases?.[phase.key] ?? false;
                  return (
                    <button
                      key={phase.key}
                      type="button"
                      onClick={() => togglePhase(phase.key)}
                      disabled={isPending}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition text-left disabled:opacity-60 ${
                        checked
                          ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15'
                          : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07]'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${checked ? 'border-emerald-400 bg-emerald-400' : 'border-white/25'}`}
                      >
                        {checked && (
                          <svg
                            className="w-3 h-3 text-zinc-900"
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
                        className={`text-sm font-medium ${checked ? 'line-through text-white/30' : 'text-white/75'}`}
                      >
                        {phase.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
