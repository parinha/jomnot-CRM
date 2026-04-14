import { Shimmer } from '@/src/components/PageSkeleton';

export default function KanbanLoading() {
  const columns = [5, 4, 6, 3];
  return (
    <div className="flex gap-4 p-4 md:p-6 h-full overflow-x-auto">
      {columns.map((cardCount, col) => (
        <div key={col} className="flex flex-col gap-3 w-64 shrink-0">
          {/* Column header */}
          <Shimmer className="h-9 w-full" />
          {/* Cards */}
          {Array.from({ length: cardCount }).map((_, i) => (
            <Shimmer key={i} className="h-24 w-full" style={{ opacity: 1 - i * 0.1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
