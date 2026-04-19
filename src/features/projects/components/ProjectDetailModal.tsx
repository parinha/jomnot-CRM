'use client';

import { PROJECT_STATUS_CONFIG } from '@/src/config/statusConfig';
import { useProjects } from '@/src/hooks/useProjects';
import { useClients } from '@/src/hooks/useClients';
import { useInvoices } from '@/src/hooks/useInvoices';
import { useAppPreferences } from '@/src/contexts/AppPreferencesContext';

interface Props {
  projectId: string;
  onClose: () => void;
}

export default function ProjectDetailModal({ projectId, onClose }: Props) {
  const { data: projects } = useProjects();
  const { data: clients } = useClients();
  const { data: invoices } = useInvoices();
  const prefs = useAppPreferences();

  const project = projects.find((p) => p.id === projectId);
  const client = project ? clients.find((c) => c.id === project.clientId) : null;
  const linkedInvs = project
    ? project.invoiceIds.map((id) => invoices.find((i) => i.id === id)).filter(Boolean)
    : [];

  const sc = project ? PROJECT_STATUS_CONFIG[project.status] : null;
  const currentPhase = project?.kanbanPhase
    ? prefs.kanbanPhases.find((p) => p.id === project.kanbanPhase)
    : prefs.kanbanPhases[0];

  const delivs = project?.items ?? [];
  const delivDone = delivs.filter((it) => it.status === 'done').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-slate-900/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {!project ? (
          <div className="p-8 text-center text-white/40 text-sm">Project not found.</div>
        ) : (
          <>
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

            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              {currentPhase && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/45">Kanban phase:</span>
                  <span className="text-xs font-semibold text-white/75 px-2 py-0.5 bg-white/[0.07] rounded-full">
                    {currentPhase.label}
                  </span>
                </div>
              )}

              {delivs.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/45">
                      Deliverables {delivDone}/{delivs.length}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${delivDone === delivs.length ? 'bg-violet-400' : 'bg-[#FFC206]'}`}
                      style={{
                        width: `${delivs.length ? Math.round((delivDone / delivs.length) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {delivs.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03]"
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${item.status === 'done' ? 'bg-violet-400' : 'bg-white/20'}`}
                        />
                        <span
                          className={`text-sm ${item.status === 'done' ? 'line-through text-white/30' : 'text-white/75'}`}
                        >
                          {item.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
