import { ExpandableTimelineEvent } from "@/components/ui/ExpandableTimelineEvent";
import type { HistoryEvent, HistoryEraSummary } from "@/lib/content-shared/church-history/timeline";

import {
  HISTORY_EVENT_ID_PREFIX,
  HISTORY_RESULTS_ID,
  HISTORY_YEAR_TARGET_ID,
  historyHref,
  type HistoryLinkState,
} from "./historyUrl";
import {
  FILTER_LABELS,
  eraRange,
  eraRangeSpoken,
  formatCount,
  type HistoryView,
} from "./historyView";

function eventCount(count: number): string {
  return count === 1 ? "1 event" : `${formatCount(count)} events`;
}

function TimelineRow({ event, view }: { event: HistoryEvent; view: HistoryView }) {
  const isTarget = view.target?.slug === event.slug;
  return (
    <li>
      {/* The year's anchor sits on its own element, so the same row can also
          carry its permanent id for links to the event itself. */}
      {isTarget && view.year !== null ? (
        <span id={HISTORY_YEAR_TARGET_ID} className="vf-timeline-anchor" />
      ) : null}
      <ExpandableTimelineEvent
        id={`${HISTORY_EVENT_ID_PREFIX}${event.slug}`}
        title={event.title}
        date={event.dateLabel}
        eyebrow={event.kindLabel}
        location={event.location}
        context={event.context}
        significance={event.significance}
        body={event.excerpt}
        links={event.links}
        initiallyOpen={view.openSlug === event.slug}
        current={isTarget}
      />
    </li>
  );
}

/**
 * The events, under era headings (h2) and century subheadings (h3), so the page
 * has a structure a blind reader can jump through by heading and a sighted
 * reader can scan. Lists are `role="list"` because Safari drops the list role
 * from a list with no markers, and VoiceOver's "list, 14 items" is worth keeping.
 */
export function HistoryEventList({ view }: { view: HistoryView }) {
  const maxYear = view.sliderMax;
  return (
    <>
      {view.groups.map((group) => (
        <section
          key={group.era.key}
          aria-labelledby={`history-era-${group.era.key}`}
          className="vf-timeline-era"
        >
          <div className="vf-timeline-era-head">
            <h2 id={`history-era-${group.era.key}`} className="vf-timeline-era-title">
              {group.era.label}
            </h2>
            <p className="vf-timeline-era-meta">
              <span aria-hidden="true">{eraRange(group.era, maxYear)}</span>
              <span className="sr-only">{eraRangeSpoken(group.era, maxYear)}</span>
              <span aria-hidden="true"> · </span>
              <span className="sr-only">, </span>
              {eventCount(group.count)}
            </p>
          </div>
          {group.centuries.map((century) => (
            <div key={century.label} className="vf-timeline-century">
              <h3 className="vf-timeline-century-title">{century.label}</h3>
              <ol role="list" className="vf-timeline-list">
                {century.events.map((event) => (
                  <TimelineRow key={event.slug} event={event} view={view} />
                ))}
              </ol>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

function pageList(current: number, total: number): Array<number | "gap"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: Array<number | "gap"> = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push("gap");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("gap");
  pages.push(total);
  return pages;
}

/**
 * Page links that land on the list rather than at the top of the page, by way
 * of the list's id: the browser does that on its own when no script is running.
 */
export function HistoryPager({ view, base }: { view: HistoryView; base: HistoryLinkState }) {
  if (view.pageCount <= 1) return null;
  const hrefOf = (page: number) => historyHref({ ...base, page }, HISTORY_RESULTS_ID);
  const { page, pageCount } = view;
  return (
    <nav aria-label="Pages of events" className="vf-history-pager">
      {page > 1 ? (
        <a href={hrefOf(page - 1)} rel="prev" className="vf-chip">
          <span aria-hidden="true">←</span> Previous
        </a>
      ) : null}
      <ol role="list">
        {pageList(page, pageCount).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="vf-history-pager-gap">
              …
            </li>
          ) : (
            <li key={p}>
              <a
                href={hrefOf(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={p === page ? "vf-chip vf-filter-active" : "vf-chip"}
              >
                {p}
              </a>
            </li>
          ),
        )}
      </ol>
      {page < pageCount ? (
        <a href={hrefOf(page + 1)} rel="next" className="vf-chip">
          Next <span aria-hidden="true">→</span>
        </a>
      ) : null}
    </nav>
  );
}

function EraLink({
  era,
  label,
  align,
  href,
  maxYear,
}: {
  era: HistoryEraSummary;
  label: string;
  align: "start" | "end";
  href: string;
  maxYear: number;
}) {
  return (
    <a
      href={href}
      className={
        align === "start" ? "vf-history-era-step" : "vf-history-era-step vf-history-era-step-end"
      }
    >
      <span className="vf-history-era-step-label">
        {align === "start" ? <span aria-hidden="true">← </span> : null}
        {label}
        {align === "end" ? <span aria-hidden="true"> →</span> : null}
      </span>
      <span className="vf-history-era-step-name">{era.label}</span>
      <span className="vf-history-era-step-years" aria-hidden="true">
        {eraRange(era, maxYear)}
      </span>
      <span className="sr-only">, {eraRangeSpoken(era, maxYear)}</span>
    </a>
  );
}

/** The eras on either side, at the foot of an era's list, in the order it reads. */
export function HistoryEraSteps({ view, base }: { view: HistoryView; base: HistoryLinkState }) {
  const { previousEra, nextEra } = view;
  if (!view.era || (!previousEra && !nextEra)) return null;
  const hrefOf = (era: HistoryEraSummary) =>
    historyHref({ ...base, era: era.key, page: null }, HISTORY_RESULTS_ID);
  return (
    <nav aria-label="Neighboring eras" className="vf-history-era-steps">
      {previousEra ? (
        <EraLink
          era={previousEra}
          label="Previous era"
          align="start"
          href={hrefOf(previousEra)}
          maxYear={view.sliderMax}
        />
      ) : (
        <span />
      )}
      {nextEra ? (
        <EraLink
          era={nextEra}
          label="Next era"
          align="end"
          href={hrefOf(nextEra)}
          maxYear={view.sliderMax}
        />
      ) : null}
    </nav>
  );
}

/** An honest empty list: what was asked for, and the ways back. */
export function HistoryEmpty({
  view,
  base,
  noneText,
  hintText,
  clearText,
}: {
  view: HistoryView;
  base: HistoryLinkState;
  noneText: string;
  hintText: string;
  clearText: string;
}) {
  const { q, theme, era } = view;
  const narrowed = era !== null || theme !== "all";
  const message = q
    ? noneText
    : theme !== "all" && era
      ? `No ${FILTER_LABELS[theme]} events in ${era.label}.`
      : "No events here.";
  return (
    <div className="vf-timeline-empty">
      <p className="vf-timeline-empty-message">{message}</p>
      {q ? <p className="vf-fineprint">{hintText}</p> : null}
      <p className="vf-timeline-empty-actions">
        {q && narrowed ? (
          <a href={historyHref({ q })} className="vf-btn vf-btn-ghost">
            Search all events
          </a>
        ) : null}
        {q ? (
          <a href={historyHref({ ...base, q: null })} className="vf-btn vf-btn-ghost">
            {clearText}
          </a>
        ) : null}
        {!q && era && theme !== "all" ? (
          <a href={historyHref({ ...base, theme: null })} className="vf-btn vf-btn-ghost">
            All of {era.label}
          </a>
        ) : null}
        {!q || narrowed ? (
          <a href={historyHref()} className="vf-btn vf-btn-ghost">
            Show all events
          </a>
        ) : null}
      </p>
    </div>
  );
}
