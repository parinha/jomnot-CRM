import { Shimmer } from '@/src/components/PageSkeleton';

export default function TimelineLoading() {
  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 shrink-0">
        <Shimmer className="h-9 w-32" />
        <Shimmer className="h-9 w-24" />
        <Shimmer className="h-9 w-24" />
        <Shimmer className="h-9 w-20 ml-auto" />
      </div>
      {/* Gantt header */}
      <Shimmer className="h-14 w-full shrink-0" />
      {/* Gantt rows */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex gap-2" style={{ opacity: 1 - i * 0.06 }}>
          <Shimmer className="h-12 w-44 shrink-0" />
          <Shimmer className="h-12 flex-1" />
        </div>
      ))}
    </div>
  );
}
