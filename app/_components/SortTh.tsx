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
      className={`font-medium text-white/45 cursor-pointer select-none hover:text-white/80 transition ${className ?? ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className={isActive ? 'text-[#FFC206]' : 'text-white/20'}>
          {isActive ? (
            dir === 'asc' ? (
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            )
          ) : (
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
            </svg>
          )}
        </span>
      </span>
    </th>
  );
}
