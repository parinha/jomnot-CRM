'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Project } from '@/src/types';
import { DEFAULT_APP_PREFERENCES } from '@/src/types';
import { fmtDate } from '@/src/lib/formatters';
import { useProjects, useProjectMutations } from '@/src/hooks/useProjects';
import { useClients } from '@/src/hooks/useClients';
import { TablePageSkeleton } from '@/src/components/PageSkeleton';
import ProgressPopover from './ProgressPopover';
import { useAppPreferences } from '@/src/contexts/AppPreferencesContext';

const PALETTE = [
  {
    hdr: 'text-sky-400',
    border: 'border-sky-500/20',
    bg: 'bg-sky-500/[0.03]',
    ring: 'ring-sky-500/30',
  },
  {
    hdr: 'text-violet-400',
    border: 'border-violet-500/20',
    bg: 'bg-violet-500/[0.03]',
    ring: 'ring-violet-500/30',
  },
  {
    hdr: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/[0.03]',
    ring: 'ring-amber-500/30',
  },
  {
    hdr: 'text-orange-400',
    border: 'border-orange-500/20',
    bg: 'bg-orange-500/[0.03]',
    ring: 'ring-orange-500/30',
  },
  {
    hdr: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/[0.03]',
    ring: 'ring-emerald-500/30',
  },
  {
    hdr: 'text-pink-400',
    border: 'border-pink-500/20',
    bg: 'bg-pink-500/[0.03]',
    ring: 'ring-pink-500/30',
  },
  {
    hdr: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/[0.03]',
    ring: 'ring-blue-500/30',
  },
  {
    hdr: 'text-teal-400',
    border: 'border-teal-500/20',
    bg: 'bg-teal-500/[0.03]',
    ring: 'ring-teal-500/30',
  },
  {
    hdr: 'text-rose-400',
    border: 'border-rose-500/20',
    bg: 'bg-rose-500/[0.03]',
    ring: 'ring-rose-500/30',
  },
  {
    hdr: 'text-indigo-400',
    border: 'border-indigo-500/20',
    bg: 'bg-indigo-500/[0.03]',
    ring: 'ring-indigo-500/30',
  },
];

function findPhaseId(el: Element | null): string | null {
  let cur = el;
  while (cur) {
    const id = (cur as HTMLElement).dataset?.phaseId;
    if (id) return id;
    cur = cur.parentElement;
  }
  return null;
}

const FILTER_KEY = 'kanban_filters';

function readFilter(key: string, def: boolean): boolean {
  if (typeof window === 'undefined') return def;
  try {
    const stored = localStorage.getItem(FILTER_KEY);
    if (!stored) return def;
    const obj = JSON.parse(stored);
    return key in obj ? Boolean(obj[key]) : def;
  } catch {
    return def;
  }
}

function saveFilter(key: string, value: boolean) {
  try {
    const stored = localStorage.getItem(FILTER_KEY);
    const obj = stored ? JSON.parse(stored) : {};
    localStorage.setItem(FILTER_KEY, JSON.stringify({ ...obj, [key]: value }));
  } catch {}
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  const prefs = useAppPreferences();
  const router = useRouter();

  const kanbanPhases =
    prefs.kanbanPhases.length > 0 ? prefs.kanbanPhases : DEFAULT_APP_PREFERENCES.kanbanPhases;

  const firstPhaseId = kanbanPhases[0].id;

  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const touchDragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const { upsert } = useProjectMutations();
  const [popover, setPopover] = useState<{ project: Project } | null>(null);

  const [showActive, setShowActive] = useState(() => readFilter('showActive', true));
  const [showCompleted, setShowCompleted] = useState(() => readFilter('showCompleted', true));
  const [showUpcoming, setShowUpcoming] = useState(() => readFilter('showUpcoming', false));
  const [showUnconfirmed, setShowUnconfirmed] = useState(() =>
    readFilter('showUnconfirmed', false)
  );

  function openPopover(e: React.MouseEvent, project: Project) {
    e.stopPropagation();
    if ((project.items ?? []).length === 0) return;
    setPopover({ project });
  }

  function toggleItem(itemId: string) {
    if (!popover) return;
    const proj = popover.project;
    const updated: Project = {
      ...proj,
      items: proj.items.map((it) =>
        it.id === itemId ? { ...it, status: it.status === 'done' ? 'todo' : 'done' } : it
      ),
    };
    setPopover((p) => (p ? { ...p, project: updated } : null));
    startTransition(async () => {
      await upsert(updated);
    });
  }

  if (isLoading) return <TablePageSkeleton rows={6} />;

  const today = localToday();
  const currentYM = today.slice(0, 7);

  function isUpcoming(p: Project): boolean {
    return !!p.confirmedMonth && p.confirmedMonth > currentYM;
  }

  const visible = projects.filter((p) => {
    if (p.status === 'confirmed' && !isUpcoming(p) && !showActive) return false;
    if (p.status === 'completed' && !showCompleted) return false;
    if (p.status === 'unconfirmed' && !showUnconfirmed) return false;
    if (isUpcoming(p) && !showUpcoming) return false;
    return true;
  });

  function getProjectPhaseId(project: Project): string {
    if (!project.kanbanPhase) return firstPhaseId;
    const exists = kanbanPhases.some((ph) => ph.id === project.kanbanPhase);
    return exists ? project.kanbanPhase : firstPhaseId;
  }

  function moveToCol(projectId: string, phaseId: string) {
    const p = projects.find((proj) => proj.id === projectId);
    if (!p) return;
    const updated: Project = { ...p, kanbanPhase: phaseId };
    startTransition(async () => {
      await upsert(updated);
    });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-white/[0.06] shrink-0 flex flex-wrap items-center gap-2">
        <h1 className="text-base font-bold text-white">Kanban</h1>
        <span className="text-xs text-white/35 mr-1">
          {visible.length} project{visible.length !== 1 ? 's' : ''}
        </span>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              {
                label: 'Active',
                active: showActive,
                toggle: () => {
                  setShowActive((v) => {
                    saveFilter('showActive', !v);
                    return !v;
                  });
                },
                activeClr: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
              },
              {
                label: 'Completed',
                active: showCompleted,
                toggle: () => {
                  setShowCompleted((v) => {
                    saveFilter('showCompleted', !v);
                    return !v;
                  });
                },
                activeClr: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
              },
              {
                label: 'Upcoming',
                active: showUpcoming,
                toggle: () => {
                  setShowUpcoming((v) => {
                    saveFilter('showUpcoming', !v);
                    return !v;
                  });
                },
                activeClr: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
              },
              {
                label: 'Unconfirmed',
                active: showUnconfirmed,
                toggle: () => {
                  setShowUnconfirmed((v) => {
                    saveFilter('showUnconfirmed', !v);
                    return !v;
                  });
                },
                activeClr: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
              },
            ] as const
          ).map(({ label, active, toggle, activeClr }) => (
            <button
              key={label}
              type="button"
              onClick={toggle}
              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[11px] font-semibold transition ${active ? activeClr : 'border-white/[0.08] text-white/25 hover:text-white/50 hover:border-white/20'}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-current' : 'bg-white/20'}`}
              />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <button
          type="button"
          onClick={() => router.push('/dashboard/settings?tab=workspace')}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-white/[0.10] text-[11px] font-medium text-white/40 hover:bg-white/[0.07] hover:text-white/70 transition"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
            />
          </svg>
          Kanban Settings
        </button>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
        <div className="flex h-full gap-3 p-4" style={{ minWidth: kanbanPhases.length * 272 }}>
          {kanbanPhases.map((phase, idx) => {
            const color = PALETTE[idx % PALETTE.length];
            const cards = sortCards(
              visible.filter((p) => getProjectPhaseId(p) === phase.id),
              today
            );
            const isOver = overCol === phase.id && dragId !== null;

            return (
              <div
                key={phase.id}
                data-phase-id={phase.id}
                className="flex flex-col shrink-0 w-64"
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(phase.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setOverCol(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) moveToCol(dragId, phase.id);
                  setDragId(null);
                  setOverCol(null);
                }}
              >
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <span className={`text-[11px] font-bold uppercase tracking-widest ${color.hdr}`}>
                    {phase.label}
                  </span>
                  <span className="text-[11px] text-white/25 font-semibold">{cards.length}</span>
                </div>

                <div
                  className={`flex-1 flex flex-col gap-2 rounded-2xl border p-2 overflow-y-auto transition-all ${color.border} ${color.bg} ${isOver ? `ring-2 ${color.ring}` : ''}`}
                >
                  {cards.map((project) => {
                    const client = clients.find((c) => c.id === project.clientId);
                    const isDragging = dragId === project.id;
                    const late = isLate(project, today);
                    const delivItems = project.items ?? [];
                    const delivDone = delivItems.filter((it) => it.status === 'done').length;
                    const hasDelivs = delivItems.length > 0;

                    return (
                      <div
                        key={project.id}
                        draggable
                        data-progress-trigger
                        style={{ touchAction: 'none' }}
                        onClick={(e) => {
                          if (touchDragRef.current?.moved) return;
                          openPopover(e, project);
                        }}
                        onDragStart={(e) => {
                          setDragId(project.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverCol(null);
                        }}
                        onTouchStart={() => {
                          touchDragRef.current = { id: project.id, moved: false };
                        }}
                        onTouchMove={(e) => {
                          if (!touchDragRef.current) return;
                          if (!touchDragRef.current.moved) {
                            touchDragRef.current.moved = true;
                            setDragId(touchDragRef.current.id);
                          }
                          const touch = e.touches[0];
                          const el = document.elementFromPoint(touch.clientX, touch.clientY);
                          const phaseId = findPhaseId(el);
                          setOverCol((prev) => (prev === phaseId ? prev : phaseId));
                        }}
                        onTouchEnd={(e) => {
                          if (touchDragRef.current?.moved) {
                            e.preventDefault();
                            if (dragId && overCol) moveToCol(dragId, overCol);
                          }
                          touchDragRef.current = null;
                          setDragId(null);
                          setOverCol(null);
                        }}
                        className={`border rounded-xl p-3 cursor-pointer select-none transition ${
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

                        {hasDelivs && (
                          <div className="flex items-center gap-1.5 mt-2.5">
                            <div className="flex-1 h-1 rounded-full bg-white/[0.08] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${delivDone === delivItems.length ? 'bg-violet-400/70' : 'bg-[#FFC206]/60'}`}
                                style={{
                                  width: `${Math.round((delivDone / delivItems.length) * 100)}%`,
                                }}
                              />
                            </div>
                            <span
                              className={`text-[10px] ${late ? 'text-red-400/60' : 'text-white/30'}`}
                            >
                              {delivDone}/{delivItems.length}
                            </span>
                          </div>
                        )}

                        {project.budget ? (
                          <p className="text-[10px] text-white/35 amt mt-1.5">
                            ${project.budget.toLocaleString()}
                          </p>
                        ) : null}

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

      {popover && (
        <ProgressPopover
          project={popover.project}
          onClose={() => setPopover(null)}
          onToggleItem={toggleItem}
        />
      )}
    </div>
  );
}
