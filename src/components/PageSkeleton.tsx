import type { CSSProperties } from 'react';

// Reusable shimmer block
export function Shimmer({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={`animate-pulse rounded-lg bg-white/[0.06] ${className ?? ''}`} style={style} />
  );
}

// Generic page skeleton: toolbar + N rows
export function TablePageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Toolbar row */}
      <div className="flex items-center gap-3">
        <Shimmer className="h-10 w-48" />
        <Shimmer className="h-10 w-28 ml-auto" />
      </div>
      {/* Table header */}
      <Shimmer className="h-10 w-full" />
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <Shimmer key={i} className="h-14 w-full" style={{ opacity: 1 - i * 0.07 }} />
      ))}
    </div>
  );
}
