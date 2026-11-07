import { getTranslator } from "@/lib/i18n/server";

import { eyebrowClass } from "./eyebrow";
import { LoadingStatus } from "./LoadingStatus";
import { heroLabel } from "./PageHero";
import { gridClass, type GridColumns } from "./PaginatedGrid";

export { LoadingStatus };

/**
 * One line of text that has not arrived yet. It sits inside the finished card's own
 * classes, so the line box it holds open is the real line's, at any text size; only
 * its width is a guess.
 */
function Line({ width }: { width: string }) {
  return <span className="vf-skeleton inline-block h-[0.62em] align-middle" style={{ width }} />;
}

/** Enough different lengths that a column of placeholders does not look ruled. */
const META_WIDTHS = ["60%", "42%", "50%"];
const SUMMARY_WIDTHS = ["100%", "92%", "100%", "75%"];

/**
 * Reusable tab loading skeleton (spec §19).
 *
 * Shown while a public tab's data fetch is in flight. It reserves what the
 * loaded page will occupy: the same hero, the same search and filter, any section
 * heading, and the same grid of the same cards, so nothing rearranges when the
 * content arrives. Keeps the page reverent — no pulsing animation that distracts
 * from the prayer-room feeling.
 */
export async function TabLoadingSkeleton({
  title,
  eyebrow,
  subtitle,
  cards = 6,
  columns = 3,
  controls = true,
  filterWidth,
  filterLabels,
  controlsNote = false,
  heading,
  titleLines = 1,
  metaLines = 1,
  themeLines = 0,
  summary = true,
}: {
  title: string;
  /** The loaded page's label and sentence, so its heading takes the same height. */
  eyebrow?: string;
  subtitle?: string;
  cards?: number;
  /** The loaded page's grid. */
  columns?: GridColumns;
  /** Whether the loaded page has a search row above its grid. */
  controls?: boolean;
  /** How wide the filter beside the search is, when the page has one: the search moves over for it. */
  filterWidth?: string;
  /** The words of a row of chips, in place of a width: chips wrap as their words require. */
  filterLabels?: readonly string[];
  /** Whether a line of text closes the control area (the way to /novenas from /devotions). */
  controlsNote?: boolean;
  /** The heading of the section the loaded page's first cards sit under. */
  heading?: string;
  /** The lines a title usually takes on this list. */
  titleLines?: number;
  /** The short lines under a title: a label, a patronage, a feast day. */
  metaLines?: number;
  /** The lines of a thematic sentence under the title (a novena's intention). */
  themeLines?: number;
  /** Whether the loaded page's cards carry a description preview and its action. */
  summary?: boolean;
}) {
  const { t } = await getTranslator();
  const label = heroLabel(eyebrow, title);
  const loading = t("common.loadingContent");
  return (
    <>
      <LoadingStatus>{loading}</LoadingStatus>
      <div aria-busy="true" data-testid="tab-loading">
        <div className="vf-page-hero">
          {label ? <p className={eyebrowClass(label)}>{label}</p> : null}
          <h1 className="vf-page-hero-title text-ink">{title}</h1>
          {/* Holds the place of a sentence the page has no text for yet. The status has said it. */}
          {subtitle ? (
            <p className="vf-page-hero-lede">{subtitle}</p>
          ) : (
            <p className="vf-page-hero-lede" aria-hidden="true">
              {loading}
            </p>
          )}
        </div>
        {controls ? (
          <div className="vf-list-controls" aria-hidden="true">
            <div className="flex min-w-0 max-w-xl flex-1 basis-[22rem] gap-1.5">
              <span className="vf-skeleton h-11 min-w-0 flex-1" />
              <span className="vf-skeleton h-11 w-[2.875rem] sm:w-[7.7375rem]" />
            </div>
            {filterWidth ? (
              <span className="vf-skeleton h-11 max-w-full" style={{ width: filterWidth }} />
            ) : null}
            {filterLabels ? (
              <div className="pointer-events-none flex flex-wrap justify-center gap-1.5">
                {filterLabels.map((label) => (
                  <span key={label} className="vf-chip vf-skeleton border-transparent">
                    <span className="invisible">{label}</span>
                  </span>
                ))}
              </div>
            ) : null}
            {controlsNote ? (
              <p className="basis-full text-center font-serif text-[length:var(--fs-note)]">
                <Line width="19rem" />
              </p>
            ) : null}
          </div>
        ) : null}
        {heading ? (
          <div className="vf-section-head" aria-hidden="true">
            <h2 className="vf-section-title">{heading}</h2>
          </div>
        ) : null}
        <ul className={gridClass(columns)} data-testid="tab-loading-cards" aria-hidden="true">
          {Array.from({ length: cards }).map((_, i) => (
            <li key={i}>
              <div className="vf-entry" data-testid="tab-loading-card">
                <p className="vf-entry-title">
                  {Array.from({ length: titleLines }).map((_, line) => (
                    <span key={line} className="block">
                      <Line width={line === titleLines - 1 ? "55%" : "85%"} />
                    </span>
                  ))}
                </p>
                {Array.from({ length: metaLines }).map((_, line) => (
                  <p key={line} className="vf-entry-meta">
                    <Line width={META_WIDTHS[line % META_WIDTHS.length]!} />
                  </p>
                ))}
                {themeLines > 0 ? (
                  <p className="vf-entry-theme">
                    {Array.from({ length: themeLines }).map((_, line) => (
                      <span key={line} className="block">
                        <Line width="70%" />
                      </span>
                    ))}
                  </p>
                ) : null}
                {summary ? (
                  <>
                    <p className="vf-entry-summary" data-testid="tab-loading-summary">
                      {SUMMARY_WIDTHS.map((width, line) => (
                        <span key={line} className="block">
                          <Line width={width} />
                        </span>
                      ))}
                    </p>
                    <p className="vf-entry-action">
                      <Line width="3rem" />
                    </p>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/**
 * The loading placeholder of a reading page: the same centred column, title and
 * lines of text as the finished page. A screen reader is told it is loading, in the
 * reader's language.
 */
export async function DetailLoadingSkeleton({ title }: { title?: string }) {
  const { t } = await getTranslator();
  return (
    <>
      <LoadingStatus>{t("common.loading")}</LoadingStatus>
      <div aria-busy="true" className="vf-detail" data-testid="detail-loading">
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
    </>
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
