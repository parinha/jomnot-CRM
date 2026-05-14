'use client';

import { useRef, useState, type ReactNode } from 'react';

interface ModalShellProps {
  onClose: () => void;
  maxWidth?: string;
  children: ReactNode;
}

export default function ModalShell({ onClose, maxWidth = 'max-w-md', children }: ModalShellProps) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidth} bg-white rounded-t-2xl md:rounded-2xl shadow-2xl animate-sheet-up md:[animation:none]`}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* drag handle — mobile only */}
        <div className="flex justify-center pt-3 md:hidden">
          <div className="w-10 h-1 rounded-full bg-zinc-200" />
        </div>
        {children}
      </div>
    </div>
  );
}
