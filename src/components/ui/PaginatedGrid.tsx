"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Responsive content grid with numbered pagination.
 *
 * Page size follows the viewport so each page is a full grid:
 *   mobile  (<640px)   → 1 column  × 10 rows = 10 items
 *   tablet  (640–1023) → 3 columns × 10 rows = 30 items
 *   desktop (≥1024px)  → 5 columns ×  5 rows = 25 items
 *
 * Numbered page boxes appear at the bottom once there is more than one page;
 * the current page is highlighted. The grid is purely client-side so it stays
 * correct as the Admin Worker publishes more content.
 */
export function pageSizeForWidth(width: number): number {
  if (width >= 1024) return 25;
  if (width >= 640) return 30;
  return 10;
}

export function PaginatedGrid({ items }: { items: ReactNode[] }) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const apply = () => setPageSize(pageSizeForWidth(window.innerWidth));
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const visible = items.slice(start, start + pageSize);

  return (
    <div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {visible.map((node, i) => (
          <li key={start + i}>{node}</li>
        ))}
      </ul>

      {pageCount > 1 ? (
        <nav
          className="mt-10 flex flex-wrap items-center justify-center gap-2"
          aria-label="Pagination"
        >
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              aria-current={n === current ? "page" : undefined}
              className={`min-w-9 rounded-sm border px-3 py-1.5 text-sm tracking-liturgical transition ${
                n === current
                  ? "border-liturgical-gold bg-liturgical-gold/10 text-ink"
                  : "border-ink/20 text-ink-soft hover:bg-ink/5"
              }`}
            >
              {n}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
