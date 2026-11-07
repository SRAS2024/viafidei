import { gridClass, type GridColumns } from "./PaginatedGrid";

/**
 * Reusable tab loading skeleton (spec §19).
 *
 * Shown while a public tab's data fetch is in flight. It reserves what the
 * loaded page will occupy: the same hero, the same search row, and the same
 * grid at the same column width, so nothing rearranges when the content
 * arrives. Keeps the page reverent — no pulsing animation that distracts from
 * the prayer-room feeling.
 */
export function TabLoadingSkeleton({
  title,
  cards = 6,
  columns = 3,
  controls = true,
  summary = true,
}: {
  title: string;
  cards?: number;
  /** The loaded page's grid. */
  columns?: GridColumns;
  /** Whether the loaded page has a search row above its grid. */
  controls?: boolean;
  /** Whether the loaded page's cards carry a description preview. */
  summary?: boolean;
}) {
  return (
    <div role="status" aria-busy="true" data-testid="tab-loading">
      <div className="vf-page-hero">
        <h1 className="vf-page-hero-title text-ink">{title}</h1>
        <p className="vf-page-hero-lede">Loading the latest published content…</p>
      </div>
      {controls ? (
        <div className="vf-list-controls" aria-hidden="true">
          <div className="flex min-w-0 max-w-xl flex-1 basis-[22rem] gap-1.5">
            <span className="vf-skeleton h-11 min-w-0 flex-1" />
            <span className="vf-skeleton h-11 w-14 sm:w-28" />
          </div>
        </div>
      ) : null}
      <ul className={gridClass(columns)} data-testid="tab-loading-cards" aria-hidden="true">
        {Array.from({ length: cards }).map((_, i) => (
          <li key={i}>
            <div className="vf-entry" data-testid="tab-loading-card">
              <span className="vf-skeleton h-6 w-3/4" />
              <span className="vf-skeleton mt-2.5 h-4 w-2/5" />
              {summary ? (
                <span className="mt-3.5 block space-y-2">
                  <span className="vf-skeleton h-4 w-full" />
                  <span className="vf-skeleton h-4 w-11/12" />
                  <span className="vf-skeleton h-4 w-3/4" />
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The loading placeholder of a reading page: the same centred column, title and
 * lines of text as the finished page.
 */
export function DetailLoadingSkeleton({ title }: { title?: string }) {
  return (
    <div role="status" aria-busy="true" className="vf-detail" data-testid="detail-loading">
      <div className="vf-detail-header">
        {title ? (
          <h1 className="vf-detail-title text-ink">{title}</h1>
        ) : (
          <span className="vf-skeleton h-12 w-3/4" aria-hidden="true" />
        )}
        <span className="vf-skeleton mt-3 h-5 w-1/2" aria-hidden="true" />
      </div>
      <div className="space-y-3" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className={`vf-skeleton h-5 ${i % 4 === 3 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

/**
 * Reusable "tab still building content" empty state (spec §19).
 *
 * Renders when the strict public query returns zero rows. The
 * message explains that the factory is still building content —
 * unlike a hard "not found", this state is expected on a fresh
 * deployment.
 */
export function TabEmptyState({
  title,
  description = "The factory is still building content for this tab. Check back soon.",
}: {
  title: string;
  description?: string;
}) {
  return (
    <div
      className="vf-card col-span-full rounded-sm px-6 py-8 text-center font-serif text-ink-soft"
      data-testid="tab-empty-state"
    >
      <h2 className="vf-subhead text-ink">{title}</h2>
      <p className="mx-auto max-w-reading">{description}</p>
    </div>
  );
}
