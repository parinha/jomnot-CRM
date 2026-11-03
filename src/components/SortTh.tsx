import { CaretDown, CaretUp, CaretUpDown } from '@phosphor-icons/react';
interface SortThProps {
  col: string;
  active: string;
  dir: 'asc' | 'desc';
  onSort: (col: string) => void;
  className?: string;
  children: React.ReactNode;
}

export default function SortTh({ col, active, dir, onSort, className, children }: SortThProps) {
  const isActive = active === col;
  return (
    <th
      onClick={() => onSort(col)}
      className={`font-medium text-muted cursor-pointer select-none hover:text-ink-2 transition ${className ?? ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className={isActive ? 'text-brand' : 'text-line-strong'}>
          {isActive ? (
            dir === 'asc' ? (
              <CaretUp className="w-3.5 h-3.5" weight="bold" aria-hidden />
            ) : (
              <CaretDown className="w-3.5 h-3.5" weight="bold" aria-hidden />
            )
          ) : (
            <CaretUpDown className="w-3.5 h-3.5" weight="bold" aria-hidden />
          )}
        </span>
      </span>
    </th>
  );
}
