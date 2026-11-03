import { CaretLeft, CaretRight } from '@phosphor-icons/react';
interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <p className="text-xs text-muted">
        {start}–{end} of {totalItems}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="h-10 w-10 flex items-center justify-center rounded-full border border-line-strong bg-subtle text-muted hover:bg-black/[0.04] hover:text-ink disabled:opacity-25 disabled:cursor-not-allowed transition"
        >
          <CaretLeft className="w-4 h-4" weight="bold" aria-hidden />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`h-10 w-10 rounded-full text-xs font-semibold transition ${p === page ? 'bg-brand text-white shadow-brand' : 'border border-line-strong bg-subtle text-muted hover:bg-black/[0.04] hover:text-ink'}`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="h-10 w-10 flex items-center justify-center rounded-full border border-line-strong bg-subtle text-muted hover:bg-black/[0.04] hover:text-ink disabled:opacity-25 disabled:cursor-not-allowed transition"
        >
          <CaretRight className="w-4 h-4" weight="bold" aria-hidden />
        </button>
      </div>
    </div>
  );
}
