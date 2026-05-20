/**
 * Reusable tab loading skeleton (spec §19).
 *
 * Shown while a public tab's data fetch is in flight. Mirrors the
 * card-grid layout the loaded page uses so the visual jump is small.
 * Keeps the page reverent — no pulsing animation that distracts from
 * the prayer-room feeling.
 */
export function TabLoadingSkeleton({ title, cards = 6 }: { title: string; cards?: number }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6" data-testid="tab-loading">
      <div className="text-center">
        <h1 className="font-display text-5xl text-ink">{title}</h1>
        <p className="mx-auto mt-3 max-w-reading font-serif text-ink-faint">
          Loading the latest published content…
        </p>
      </div>
      <div
        className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="tab-loading-cards"
      >
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="vf-card rounded-sm p-6 sm:p-7"
            aria-hidden="true"
            data-testid="tab-loading-card"
          >
            <div className="h-3 w-24 rounded bg-ink/10" />
            <div className="mt-4 h-6 w-3/4 rounded bg-ink/10" />
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full rounded bg-ink/5" />
              <div className="h-3 w-11/12 rounded bg-ink/5" />
              <div className="h-3 w-10/12 rounded bg-ink/5" />
            </div>
          </div>
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
      className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint"
      data-testid="tab-empty-state"
    >
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <p className="mt-3 max-w-reading">{description}</p>
    </div>
  );
}
