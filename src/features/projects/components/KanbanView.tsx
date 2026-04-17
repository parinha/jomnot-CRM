'use client';

import { useState, useTransition } from 'react';
import type { Project, ProjectPhases } from '@/src/types';
import { fmtDate } from '@/src/lib/formatters';
import { useProjects, useProjectMutations } from '@/src/hooks/useProjects';
import { useClients } from '@/src/hooks/useClients';
import { TablePageSkeleton } from '@/src/components/PageSkeleton';

const PHASE_ORDER: (keyof ProjectPhases)[] = [
  'filming',
  'roughCut',
  'draft',
  'master',
  'delivered',
];

const COLUMNS = [
  {
    key: 'filming',
    label: 'Filming',
    hdr: 'text-sky-400',
    border: 'border-sky-500/20',
    bg: 'bg-sky-500/[0.03]',
    ring: 'ring-sky-500/30',
  },
  {
    key: 'roughCut',
    label: 'Rough Cut',
    hdr: 'text-violet-400',
    border: 'border-violet-500/20',
    bg: 'bg-violet-500/[0.03]',
    ring: 'ring-violet-500/30',
  },
  {
    key: 'draft',
    label: 'Draft / VO',
    hdr: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/[0.03]',
    ring: 'ring-amber-500/30',
  },
  {
    key: 'master',
    label: 'Master',
    hdr: 'text-orange-400',
    border: 'border-orange-500/20',
    bg: 'bg-orange-500/[0.03]',
    ring: 'ring-orange-500/30',
  },
  {
    key: 'delivered',
    label: 'Done',
    hdr: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/[0.03]',
    ring: 'ring-emerald-500/30',
  },
  {
    key: 'completed',
    label: 'Completed',
    hdr: 'text-white/35',
    border: 'border-white/[0.07]',
    bg: 'bg-white/[0.015]',
    ring: 'ring-white/20',
  },
];

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getProjectCol(project: Project): string {
  if (project.status === 'completed') return 'completed';
  for (const key of PHASE_ORDER) {
    if (!project.phases?.[key]) return key;
  }
  return 'delivered';
}

function getPhasesForCol(col: string): ProjectPhases {
  const colIdx = PHASE_ORDER.indexOf(col as keyof ProjectPhases);
  const phases: ProjectPhases = {
    filming: false,
    roughCut: false,
    draft: false,
    master: false,
    delivered: false,
  };
  for (let i = 0; i < colIdx; i++) {
    phases[PHASE_ORDER[i]] = true;
  }
  if (col === 'delivered' || col === 'completed') {
    phases.delivered = true;
  }
  return phases;
}

function relDays(deliverDate: string, today: string): string {
  const diff = Math.round(
    (new Date(deliverDate).getTime() - new Date(today).getTime()) / 86_400_000
  );
  if (diff === 0) return 'due today';
  if (diff === -1) return '1 day late';
  if (diff < 0) return `${Math.abs(diff)} days late`;
  if (diff === 1) return 'in 1 day';
  return `in ${diff} days`;
}

function isLate(project: Project, today: string): boolean {
  return !!project.deliverDate && project.deliverDate < today && project.status !== 'completed';
}

function sortCards(cards: Project[], today: string): Project[] {
  return [...cards].sort((a, b) => {
    const aLate = isLate(a, today);
    const bLate = isLate(b, today);
    if (aLate !== bLate) return aLate ? -1 : 1;
    if (a.deliverDate && b.deliverDate) return a.deliverDate.localeCompare(b.deliverDate);
    if (a.deliverDate) return -1;
    if (b.deliverDate) return 1;
    return 0;
  });
}

export default function KanbanView() {
  const { data: projects, isLoading } = useProjects();
  const { data: clients } = useClients();

  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { upsert } = useProjectMutations();

  if (isLoading) return <TablePageSkeleton rows={6} />;

  const today = localToday();

  const visible = projects.filter((p) => p.status === 'confirmed' || p.status === 'completed');

  function moveToCol(projectId: string, newCol: string) {
    const p = projects.find((proj) => proj.id === projectId);
    if (!p) return;
    const newPhases = getPhasesForCol(newCol);
    const isCompleting = newCol === 'completed';
    const wasCompleted = p.status === 'completed';
    const updated: Project = {
      ...p,
      phases: newPhases,
      status: isCompleting ? 'completed' : wasCompleted ? 'confirmed' : p.status,
      completedAt: isCompleting
        ? localToday()
        : wasCompleted && !isCompleting
          ? undefined
          : p.completedAt,
    };
    startTransition(async () => {
      await upsert(updated);
    });
  }

  function markComplete(project: Project) {
    const updated: Project = {
      ...project,
      phases: getPhasesForCol('completed'),
      status: 'completed',
      completedAt: localToday(),
    };
    startTransition(async () => {
      await upsert(updated);
    });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/[0.06] shrink-0 flex items-center gap-3">
        <h1 className="text-base font-bold text-white">Kanban</h1>
        <span className="text-xs text-white/35">
          {visible.length} project{visible.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
        <div className="flex h-full gap-3 p-4" style={{ minWidth: COLUMNS.length * 268 }}>
          {COLUMNS.map((col) => {
            const cards = sortCards(
              visible.filter((p) => getProjectCol(p) === col.key),
              today
            );
            const isOver = overCol === col.key && dragId !== null;

            return (
              <div
                key={col.key}
                className="flex flex-col shrink-0 w-64"
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(col.key);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setOverCol(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) moveToCol(dragId, col.key);
                  setDragId(null);
                  setOverCol(null);
                }}
              >
                {/* Column header */}
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <span className={`text-[11px] font-bold uppercase tracking-widest ${col.hdr}`}>
                    {col.label}
                  </span>
                  <span className="text-[11px] text-white/25 font-semibold">{cards.length}</span>
                </div>

                {/* Drop zone */}
                <div
                  className={`flex-1 flex flex-col gap-2 rounded-2xl border p-2 overflow-y-auto transition-all ${col.border} ${col.bg} ${isOver ? `ring-2 ${col.ring}` : ''}`}
                >
                  {cards.map((project) => {
                    const client = clients.find((c) => c.id === project.clientId);
                    const isDragging = dragId === project.id;
                    const doneCount = PHASE_ORDER.filter((k) => project.phases?.[k]).length;
                    const inDelivered = col.key === 'delivered';
                    const late = isLate(project, today);

                    return (
                      <div
                        key={project.id}
                        draggable
                        onDragStart={(e) => {
                          setDragId(project.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverCol(null);
                        }}
                        className={`border rounded-xl p-3 cursor-grab active:cursor-grabbing select-none transition ${
                          isDragging
                            ? 'opacity-30 scale-95 bg-white/[0.06] border-white/[0.08]'
                            : late
                              ? 'bg-red-500/[0.08] border-red-500/30 hover:bg-red-500/[0.13] hover:border-red-500/50'
                              : 'bg-white/[0.06] border-white/[0.08] hover:bg-white/[0.09] hover:border-white/[0.14]'
                        }`}
                      >
                        <p className="text-sm font-semibold text-white leading-snug truncate">
                          {project.name}
                        </p>
                        {client && (
                          <p
                            className={`text-xs truncate mt-0.5 ${late ? 'text-red-300/50' : 'text-white/40'}`}
                          >
                            {client.name}
                          </p>
                        )}

                        {/* Phase progress bar */}
                        <div className="flex items-center gap-1 mt-2.5">
                          {PHASE_ORDER.map((k) => (
                            <div
                              key={k}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                project.phases?.[k] ? 'bg-emerald-400/70' : 'bg-white/[0.08]'
                              }`}
                            />
                          ))}
                        </div>

                        <div className="flex items-center justify-between mt-1.5">
                          <span
                            className={`text-[10px] ${late ? 'text-red-400/60' : 'text-white/30'}`}
                          >
                            {doneCount}/5 phases
                          </span>
                          {project.budget ? (
                            <span className="text-[10px] text-white/35 amt">
                              ${project.budget.toLocaleString()}
                            </span>
                          ) : null}
                        </div>

                        {project.deliverDate && (
                          <p
                            className={`text-[10px] mt-1 flex items-center gap-1.5 ${late ? 'text-red-400 font-semibold' : 'text-white/25'}`}
                          >
                            <span>
                              {late ? 'Overdue ' : 'Due '}
                              {fmtDate(project.deliverDate)}
                            </span>
                            <span
                              className={`${late ? 'bg-red-500/20 text-red-300' : 'bg-white/[0.07] text-white/40'} px-1.5 py-0.5 rounded-full text-[9px] font-semibold`}
                            >
                              {relDays(project.deliverDate, today)}
                            </span>
                          </p>
                        )}

                        {inDelivered && (
                          <button
                            onClick={() => markComplete(project)}
                            disabled={isPending}
                            className="mt-2.5 w-full h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/25 transition disabled:opacity-50"
                          >
                            Mark as Completed
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {cards.length === 0 && (
                    <div className="flex-1 flex items-center justify-center py-8">
                      <p className="text-[11px] text-white/15">Drop here</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
