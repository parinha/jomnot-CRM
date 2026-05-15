'use client';

import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalShellProps {
  onClose: () => void;
  maxWidth?: string;
  children: ReactNode;
}

export default function ModalShell({ onClose, maxWidth = 'max-w-md', children }: ModalShellProps) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  if (typeof document === 'undefined') return null;

  function onTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setDragY(delta);
  }

  function onTouchEnd() {
    if (dragY > 100) {
      onClose();
    } else {
      setDragY(0);
    }
    startY.current = null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidth} bg-zinc-900 border border-white/[0.08] rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] animate-sheet-up`}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        {/* drag handle — mobile only; touch events scoped here so form scroll isn't intercepted */}
        <div
          className="flex justify-center pt-3 pb-1 shrink-0 touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
