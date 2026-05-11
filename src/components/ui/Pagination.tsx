import Link from "next/link";

type PaginationProps = {
  basePath: string;
  page: number;
  totalPages: number;
  searchParams?: Record<string, string | undefined>;
  pageParam?: string;
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
}: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = buildPageList(page, totalPages);
  return (
    <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Pagination">
      {pages.map((p, idx) => {
        if (p === "…") {
          return (
            <span
              key={`gap-${idx}`}
              aria-hidden="true"
              className="px-2 font-serif text-sm text-ink-faint"
            >
              …
            </span>
          );
        }
        const isCurrent = p === page;
        const href = buildHref(basePath, pageParam, p, searchParams);
        const classes = [
          "inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-sm border px-3 font-serif text-sm transition",
          isCurrent
            ? "border-ink/40 bg-ink/5 text-ink"
            : "border-ink/15 text-ink-soft hover:border-ink/30 hover:text-ink",
        ].join(" ");
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
