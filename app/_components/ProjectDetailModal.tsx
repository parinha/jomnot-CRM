'use client'

import { useStore } from '@/app/dashboard/AppStore'
import { ITEM_STATUS_CONFIG, ITEM_STATUS_NEXT, PROJECT_STATUS_CONFIG } from '@/app/_config/statusConfig'
import ModalShell from './ModalShell'

export default function ProjectDetailModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { projects, setProjects, clients, invoices } = useStore()
  const project = projects.find((p) => p.id === projectId)
  const client  = project ? clients.find((c) => c.id === project.clientId) : null

  if (!project) return (
    <ModalShell onClose={onClose} maxWidth="max-w-sm">
      <div className="p-8 text-center text-zinc-400 text-sm">Project not found.</div>
    </ModalShell>
  )

  const doneCount  = project.items.filter((it) => it.status === 'done').length
  const totalItems = project.items.length
  const pct        = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0
  const sc         = PROJECT_STATUS_CONFIG[project.status]
  const linkedInvs = project.invoiceIds.map((id) => invoices.find((i) => i.id === id)).filter(Boolean)

  function cycleItem(itemId: string) {
    setProjects(projects.map((p) =>
      p.id !== project!.id ? p : {
        ...p,
        items: p.items.map((it) => it.id !== itemId ? it : { ...it, status: ITEM_STATUS_NEXT[it.status] }),
      }
    ))
  }

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-lg">
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-semibold text-zinc-900">{project.name}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>{sc.label}</span>
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">
              {client?.name ?? '—'}
              {linkedInvs.length > 0 && (
                <span className="text-zinc-400"> · {linkedInvs.map((i) => i?.number).join(', ')}</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 transition shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                <span className="text-xs text-zinc-500">{doneCount}/{totalItems} done</span>
                <span className="text-xs font-semibold text-zinc-700">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-brand'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Scope items */}
          {project.items.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-6">No scope items in this project.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {project.items.map((item) => {
                const cfg = ITEM_STATUS_CONFIG[item.status]
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 hover:border-zinc-200 transition">
                    <button
                      onClick={() => cycleItem(item.id)}
                      className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium transition hover:opacity-80 ${cfg.cls}`}
                      title="Click to cycle status"
                    >
                      {cfg.label}
                    </button>
                    <span className={`text-sm flex-1 ${item.status === 'done' ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>
                      {item.description}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-zinc-100 shrink-0">
          <p className="text-xs text-zinc-400">Click a status badge to cycle: To Do → In Progress → Done</p>
        </div>
      </div>
    </ModalShell>
  )
}
