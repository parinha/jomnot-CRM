import { Shimmer } from '@/src/components/PageSkeleton';

export default function SettingsLoading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      {/* Section title */}
      <Shimmer className="h-7 w-40" />
      {/* Form fields */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Shimmer className="h-4 w-28" />
          <Shimmer className="h-11 w-full" />
        </div>
      ))}
      {/* Second section */}
      <Shimmer className="h-7 w-48 mt-8" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Shimmer className="h-4 w-28" />
          <Shimmer className="h-11 w-full" />
        </div>
      ))}
      {/* Save button */}
      <Shimmer className="h-11 w-32 mt-2" />
    </div>
  );
}
