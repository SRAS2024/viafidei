import Link from "next/link";

/**
 * How many cards a public list page shows per page. One number for the whole
 * site so `?page=2` means the same thing everywhere and the SQL `skip/take`
 * matches what the links promise. Divisible by 2, 3 and 4, so a full page of a
 * collection never strands a card on its last row.
 */
export const LIST_PAGE_SIZE = 36;

/** `?page=` → a 1-based page number. Anything unparseable is page 1. */
export function parsePageParam(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export interface SlicedPage<T> {
  items: T[];
  /** Clamped into `[1, pageCount]` so `?page=999` shows the last page. */
  page: number;
  pageCount: number;
  total: number;
}

/**
 * Server-side slice for the content types small enough to still be read whole
 * (the projection `listPublishedPage` returns carries no payload, and these
 * cards show payload prose — a guide's summary, a rite's history). Slicing
 * here still means only one page of cards is rendered and serialised into the
 * RSC payload, and the page links stay real URLs.
 */
export function pageSlice<T>(
  items: readonly T[],
  page: number,
  pageSize: number = LIST_PAGE_SIZE,
): SlicedPage<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, pageCount, total };
}

type PaginationProps = {
  basePath: string;
  page: number;
  totalPages: number;
  searchParams?: Record<string, string | undefined>;
  pageParam?: string;
  /** What a screen reader calls this set of links, when a page has more than one. */
  label?: string;
};

function buildHref(
  basePath: string,
  pageParam: string,
  pageNumber: number,
  extra: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(extra)) {
    if (key === pageParam) continue;
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    }
  }
  if (pageNumber > 1) {
    params.set(pageParam, String(pageNumber));
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function buildPageList(current: number, total: number): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: Array<number | "…"> = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push("…");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

export function Pagination({
  basePath,
  page,
  totalPages,
  searchParams = {},
  pageParam = "page",
  label = "Pagination",
}: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = buildPageList(page, totalPages);
  return (
    <nav
      className="mt-[var(--space-related)] flex flex-wrap items-center justify-center gap-1.5"
      aria-label={label}
    >
      {pages.map((p, idx) => {
        if (p === "…") {
          return (
            <span
              key={`gap-${idx}`}
              aria-hidden="true"
              className="px-1.5 font-sans text-sm text-ink-faint"
            >
              …
            </span>
          );
        }
        const isCurrent = p === page;
        const href = buildHref(basePath, pageParam, p, searchParams);
        const classes = `vf-chip min-w-[2.5rem] !px-2 tabular-nums ${isCurrent ? "vf-filter-active" : ""}`;
        return (
          <Link
            key={p}
            href={href}
            className={classes}
            aria-current={isCurrent ? "page" : undefined}
            aria-label={`Page ${p}`}
          >
            {p}
          </Link>
        );
      })}
    </nav>
  );
}
