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
      <p className="text-xs text-white/40">
        {start}–{end} of {totalItems}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`h-10 w-10 rounded-xl text-xs font-semibold transition ${p === page ? 'bg-[#FFC206] text-zinc-900 shadow-md shadow-amber-500/20' : 'border border-white/15 bg-white/[0.06] text-white/60 hover:bg-white/10 hover:text-white'}`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="h-10 w-10 flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
