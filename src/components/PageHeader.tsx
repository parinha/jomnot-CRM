import type { ReactNode } from 'react';

/** Screen title row: title + subtitle on the left, primary action on the right. */
export function PageHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5 md:mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-semibold text-ink truncate">{title}</h1>
        {sub && <p className="text-sm text-muted mt-0.5">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Friendly empty / no-results state inside a white card. */
export function EmptyCard({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="bg-surface shadow-card rounded-3xl flex flex-col items-center justify-center text-center px-6 py-14 md:py-20">
      <div className="w-20 h-20 rounded-full bg-brand-soft flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-base font-semibold text-ink">{title}</p>
      {text && <p className="text-sm text-muted mt-1 max-w-xs">{text}</p>}
      {action}
    </div>
  );
}
