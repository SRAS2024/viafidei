"use client";

import { useDeferredValue, useMemo, useState } from "react";
// Import the leaf components directly, NOT through "@/components/ui".
// The barrel also re-exports PublishedDetail / PublishedList /
// RelatedContentLinks, which import values from "@/lib/data/published";
// that module uses Prisma.sql for search, so a client component pulling
// the barrel drags the Prisma client into the browser bundle and every
// page dies at hydration with "sqltag is unable to run in this browser
// environment". Caught by the e2e smoke suite.
import { ExpandableTimelineEvent } from "@/components/ui/ExpandableTimelineEvent";
import { FilterChips } from "@/components/ui/FilterChips";
import type { HistoryEra } from "@/lib/content-shared/church-history/types";
import type { HistoryEraSummary, HistoryEvent } from "@/lib/content-shared/church-history/timeline";

export type { HistoryEraSummary, HistoryEvent };

export type HistoryFilterKey =
  | "all"
  | "beginnings"
  | "councils"
  | "doctrine"
  | "saints"
  | "schisms"
  | "marian"
  | "modern";

export const FILTER_LABELS: Record<HistoryFilterKey, string> = {
  all: "All",
  beginnings: "Beginnings",
  councils: "Councils",
  doctrine: "Doctrine & Magisterium",
  saints: "Saints & Martyrs",
  schisms: "Schisms & Reform",
  marian: "Our Lady",
  modern: "Modern Era",
};

const FILTER_KEYS = Object.keys(FILTER_LABELS) as HistoryFilterKey[];

const MODERN_ERAS: ReadonlySet<HistoryEra> = new Set([
  "revolution-19c",
  "twentieth",
  "post-conciliar",
]);

/**
 * Filters are keyed on the event's era, kind and tags — the fields every
 * event (static or document-derived) actually carries — never on title
 * regexes or period strings no event can have (audit HIST-01).
 */
export function matchesHistoryFilter(event: HistoryEvent, filter: HistoryFilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "beginnings":
      return event.era === "apostolic" || event.era === "persecution";
    case "councils":
      return event.kind === "council";
    case "doctrine":
      return event.kind === "document";
    case "saints":
      return event.kind === "saint" || event.kind === "martyrdom" || event.tags.includes("doctor");
    case "schisms":
      return (
        event.kind === "schism" ||
        event.tags.includes("schism") ||
        event.tags.includes("reform") ||
        event.tags.includes("reformation")
      );
    case "marian":
      return event.kind === "apparition" || event.tags.includes("marian");
    case "modern":
      return MODERN_ERAS.has(event.era);
    default:
      return true;
  }
}

type Props = {
  events: HistoryEvent[];
  eras: HistoryEraSummary[];
  minYear: number;
  maxYear: number;
};

/** Arrow keys move 5 years; Shift+arrow moves 1 (the slider's DOM step stays 1 so dragging is continuous). */
export const SLIDER_KEY_STEP = 5;

function eraOf(eras: HistoryEraSummary[], year: number): HistoryEraSummary | undefined {
  return eras.find((e) => year >= e.from && year < e.to) ?? eras[eras.length - 1];
}

/** Era range label; the open-ended last era reads "1965–today". */
function eraRange(era: HistoryEraSummary, maxYear: number): string {
  return era.to > maxYear ? `${era.from}–today` : `${era.from}–${era.to}`;
}

export function HistoryTimelineClient({ events, eras, minYear, maxYear }: Props) {
  const [selectedYear, setSelectedYear] = useState<number>(maxYear);
  const [filter, setFilter] = useState<HistoryFilterKey>("all");
  const [typedYear, setTypedYear] = useState<string>(String(maxYear));
  const [newestFirst, setNewestFirst] = useState(false);
  // Dragging the slider re-filters hundreds of rows; deferring keeps the
  // thumb responsive and lets React render the list when it catches up.
  const deferredYear = useDeferredValue(selectedYear);

  const filterCounts = useMemo(() => {
    const counts = {} as Record<HistoryFilterKey, number>;
    for (const key of FILTER_KEYS) {
      counts[key] = events.filter((e) => matchesHistoryFilter(e, key)).length;
    }
    return counts;
  }, [events]);

  // Events up to and including the selected year, plus the active filter,
  // grouped under their era in era order. `events` arrive chronologically
  // sorted, so each group stays chronological; grouping by era (not by
  // consecutive run) keeps one header per era even where a boundary-year
  // event closes the era it ends (Vatican II's close, December 1965).
  const groups = useMemo(() => {
    const byEra = new Map<HistoryEra, HistoryEvent[]>();
    for (const event of events) {
      if (event.year > deferredYear || !matchesHistoryFilter(event, filter)) continue;
      const list = byEra.get(event.era);
      if (list) list.push(event);
      else byEra.set(event.era, [event]);
    }
    const out: Array<{ era: HistoryEraSummary; events: HistoryEvent[] }> = [];
    for (const era of eras) {
      const list = byEra.get(era.key);
      if (list) out.push({ era, events: list });
    }
    if (newestFirst) {
      out.reverse();
      for (const g of out) g.events.reverse();
    }
    return out;
  }, [events, eras, deferredYear, filter, newestFirst]);
  const visibleCount = groups.reduce((n, g) => n + g.events.length, 0);

  const setYear = (year: number) => {
    const clamped = Math.max(minYear, Math.min(maxYear, year));
    setSelectedYear(clamped);
    setTypedYear(String(clamped));
  };

  const onTypedYearSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = parseInt(typedYear, 10);
    if (!Number.isFinite(parsed)) return;
    setYear(parsed);
  };

  const onSliderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const step = e.shiftKey ? 1 : SLIDER_KEY_STEP;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setYear(selectedYear + step);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setYear(selectedYear - step);
    }
  };

  const jumpToEra = (era: HistoryEraSummary) => {
    // Show the whole era (its last year) and bring its first event into view.
    setYear(Math.min(era.to - 1, maxYear));
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document
          .getElementById(`history-era-${era.key}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const currentEra = eraOf(eras, selectedYear);
  const span = Math.max(1, maxYear - minYear);
  const pct = (year: number) => `${((year - minYear) / span) * 100}%`;

  return (
    <div className="flex flex-col gap-8">
      {/* Filter chips keyed on era / kind / tags, each with its count. */}
      <FilterChips
        ariaLabel="Filter the timeline by theme"
        activeKey={filter}
        onSelect={(k) => setFilter(k as HistoryFilterKey)}
        items={FILTER_KEYS.map((k) => ({
          key: k,
          label: FILTER_LABELS[k],
          count: filterCounts[k],
        }))}
      />

      {/* Year slider + era ticks + jump-to-era + year input.
          The slider scrubs through the whole arc of Christian history; the
          adjacent input lets the user type a precise year. Both stay in
          sync — moving the slider updates the input and vice-versa. */}
      <div className="vf-card rounded-sm p-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="vf-eyebrow">Year</p>
          <p className="font-display text-2xl text-ink">
            {selectedYear} AD
            {currentEra ? (
              <span className="ml-2 font-serif text-sm text-ink-faint">· {currentEra.label}</span>
            ) : null}
          </p>
        </div>
        <input
          type="range"
          min={minYear}
          max={maxYear}
          step={1}
          value={selectedYear}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
          onKeyDown={onSliderKeyDown}
          aria-label="Scroll through Church history by year"
          aria-valuetext={`${selectedYear} AD · ${currentEra?.label ?? ""}`.trim()}
          className="vf-history-slider mt-3 w-full"
        />
        {/* Era boundaries under the track. Labels alternate height so the
            crowded modern end (1789 / 1914 / 1965) stays legible. */}
        <div className="relative mt-1 h-7" aria-hidden="true">
          {eras
            .filter((era) => era.from > minYear)
            .map((era, i) => (
              <span
                key={era.key}
                className="absolute top-0 flex flex-col items-center"
                style={{ left: pct(era.from), transform: "translateX(-50%)" }}
                title={`${era.label} · ${eraRange(era, maxYear)}`}
              >
                <span className="block h-2 w-px bg-ink/30" />
                <span
                  className={`hidden font-sans text-[0.6rem] tabular-nums text-ink-faint sm:block ${
                    i % 2 === 1 ? "mt-2.5" : ""
                  }`}
                >
                  {era.from}
                </span>
              </span>
            ))}
        </div>
        <div className="mt-1 flex justify-between font-serif text-xs text-ink-faint">
          <span>{minYear} AD · Christ&rsquo;s ministry</span>
          <span>{maxYear} · today</span>
        </div>
        <p className="mt-1 font-sans text-[0.65rem] text-ink-faint">
          Arrow keys move {SLIDER_KEY_STEP} years; hold Shift for one year at a time.
        </p>

        <div className="mt-5">
          <p className="vf-eyebrow">Jump to an era</p>
          <div role="group" aria-label="Jump to an era" className="mt-2 flex flex-wrap gap-1.5">
            {eras.map((era) => {
              const active = currentEra?.key === era.key;
              return (
                <button
                  key={era.key}
                  type="button"
                  onClick={() => jumpToEra(era)}
                  aria-current={active ? "true" : undefined}
                  title={eraRange(era, maxYear)}
                  className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-liturgical transition ${
                    active
                      ? "vf-filter-active"
                      : "border-transparent bg-ink/5 text-ink-soft hover:bg-ink/10 hover:text-ink"
                  }`}
                >
                  <span>{era.label}</span>
                  <span className="font-semibold tabular-nums opacity-70">{era.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={onTypedYearSubmit} className="mt-5 flex items-center gap-3">
          <label htmlFor="historyYearInput" className="vf-eyebrow whitespace-nowrap">
            Or jump to year
          </label>
          <input
            id="historyYearInput"
            type="number"
            inputMode="numeric"
            min={minYear}
            max={maxYear}
            value={typedYear}
            onChange={(e) => setTypedYear(e.target.value)}
            className="vf-input !w-28 !py-1.5"
          />
          <button type="submit" className="vf-btn vf-btn-ghost !py-1.5 !px-4 text-sm">
            Go
          </button>
        </form>
      </div>

      {/* Result count + order toggle. Oldest-first by default so the list
          reads from Pentecost forward, as the page promises. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-serif text-sm text-ink-faint">
          Showing {visibleCount} event{visibleCount === 1 ? "" : "s"} through {deferredYear} AD
          {filter === "all" ? "" : ` · ${FILTER_LABELS[filter]}`}.
        </p>
        <button
          type="button"
          aria-pressed={newestFirst}
          onClick={() => setNewestFirst((v) => !v)}
          className="vf-btn vf-btn-ghost !py-1 !px-3 text-xs"
        >
          {newestFirst ? "Oldest first" : "Newest first"}
        </button>
      </div>

      <div className="vf-card rounded-sm p-2 sm:p-4">
        {groups.length === 0 ? (
          <p className="px-4 py-10 text-center font-serif text-ink-faint">
            No events match the current filter at or before {deferredYear} AD.
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.era.key} aria-labelledby={`history-era-${group.era.key}`}>
              <h3
                id={`history-era-${group.era.key}`}
                className="vf-eyebrow sticky top-0 z-10 -mx-2 scroll-mt-24 border-b border-ink/10 bg-paper px-4 py-2 sm:-mx-4"
              >
                {group.era.label} · {eraRange(group.era, maxYear)} · {group.events.length} event
                {group.events.length === 1 ? "" : "s"}
              </h3>
              {group.events.map((event) => (
                <ExpandableTimelineEvent
                  key={event.slug}
                  id={`history-event-${event.slug}`}
                  title={event.title}
                  date={event.dateLabel}
                  eyebrow={event.kindLabel}
                  location={event.location}
                  context={event.context}
                  significance={event.significance}
                  body={event.excerpt}
                  links={event.links}
                  citation={event.citation}
                />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
