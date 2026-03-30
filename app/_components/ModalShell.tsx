import type { ReactNode } from 'react'

interface ModalShellProps {
  onClose: () => void
  maxWidth?: string
  children: ReactNode
}

export default function ModalShell({ onClose, maxWidth = 'max-w-md', children }: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`w-full ${maxWidth} bg-white rounded-2xl shadow-xl`}>
        {children}
      </div>
    </div>
  )
}
