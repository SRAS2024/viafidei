"use client";

import { useMemo, useState } from "react";
import { ExpandableTimelineEvent } from "@/components/ui";

export type HistoryEvent = {
  slug: string;
  title: string;
  date: string;
  sortYear: number;
  period: string;
  periodLabel: string;
  location?: string;
  context?: string;
  issues?: string;
  significance?: string;
  body?: string;
};

export type HistoryFilterKey =
  | "all"
  | "beginnings"
  | "councils"
  | "schisms"
  | "doctrine"
  | "modern";

const FILTER_LABELS: Record<HistoryFilterKey, string> = {
  all: "All",
  beginnings: "Beginnings",
  councils: "Councils",
  schisms: "Schisms & Reform",
  doctrine: "Doctrine & Magisterium",
  modern: "Modern Era",
};

type Props = {
  events: HistoryEvent[];
  minYear: number;
  maxYear: number;
};

function matchesFilter(event: HistoryEvent, filter: HistoryFilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "beginnings") {
    return (
      event.period === "apostolic" || event.period === "persecution" || event.period === "fathers"
    );
  }
  if (filter === "councils") {
    return (
      /council|nicaea|chalcedon|ephesus|trent|lateran|vatican|constantinople/i.test(event.title) ||
      event.slug.startsWith("council-") ||
      event.period === "councils-early" ||
      event.period === "vatican-i" ||
      event.period === "vatican-ii" ||
      event.period === "trent"
    );
  }
  if (filter === "schisms") {
    return (
      event.period === "schism" ||
      event.period === "reformation" ||
      /schism|reformation|luther|protest/i.test(event.title)
    );
  }
  if (filter === "doctrine") {
    return (
      event.slug.startsWith("encyclical-") ||
      event.slug.startsWith("catechism-") ||
      event.slug.startsWith("code-of-canon-law-") ||
      /encyclical|catechism|canon law|magisterium|doctrine|dogma/i.test(event.title)
    );
  }
  if (filter === "modern") {
    return event.sortYear >= 1789;
  }
  return true;
}

export function HistoryTimelineClient({ events, minYear, maxYear }: Props) {
  const [selectedYear, setSelectedYear] = useState<number>(maxYear);
  const [filter, setFilter] = useState<HistoryFilterKey>("all");
  const [typedYear, setTypedYear] = useState<string>(String(maxYear));

  // Events up to and including the selected year, plus the active filter.
  // We show everything from the start of Christian history up to the slider
  // position so the user sees the full lineage as they drag toward "today".
  const visible = useMemo(() => {
    return events
      .filter((e) => e.sortYear <= selectedYear && matchesFilter(e, filter))
      .sort((a, b) => b.sortYear - a.sortYear);
  }, [events, selectedYear, filter]);

  const onTypedYearSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = parseInt(typedYear, 10);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(minYear, Math.min(maxYear, parsed));
    setSelectedYear(clamped);
    setTypedYear(String(clamped));
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Filter pills — Beginnings / Councils / Schisms / Doctrine / Modern */}
      <div className="flex flex-wrap justify-center gap-2">
        {(Object.keys(FILTER_LABELS) as HistoryFilterKey[]).map((k) => {
          const active = k === filter;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              aria-pressed={active}
              className={`vf-btn !py-1 !px-4 text-xs ${active ? "vf-btn-primary" : "vf-btn-ghost"}`}
            >
              {FILTER_LABELS[k]}
            </button>
          );
        })}
      </div>

      {/* Year slider + year input.
          The slider scrubs through the whole arc of Christian history; the
          adjacent input lets the user type a precise year. Both stay in
          sync — moving the slider updates the input and vice-versa. */}
      <div className="vf-card rounded-sm p-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="vf-eyebrow">Year</p>
          <p className="font-display text-2xl text-ink">{selectedYear} AD</p>
        </div>
        <input
          type="range"
          min={minYear}
          max={maxYear}
          step={1}
          value={selectedYear}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            setSelectedYear(v);
            setTypedYear(String(v));
          }}
          aria-label="Scroll through Church history by year"
          className="vf-history-slider mt-3 w-full"
        />
        <div className="mt-1 flex justify-between font-serif text-xs text-ink-faint">
          <span>{minYear} AD · Christ&rsquo;s ministry</span>
          <span>{maxYear} · today</span>
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

      {/* Result count + filtered events, newest-first below the slider. */}
      <p className="text-center font-serif text-sm text-ink-faint">
        Showing {visible.length} event{visible.length === 1 ? "" : "s"} through {selectedYear} AD
        {filter === "all" ? "" : ` · ${FILTER_LABELS[filter]}`}.
      </p>

      <div className="vf-card rounded-sm p-2 sm:p-4">
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center font-serif text-ink-faint">
            No events match the current filter at or before {selectedYear} AD.
          </p>
        ) : (
          visible.map((event) => (
            <ExpandableTimelineEvent
              key={event.slug}
              title={event.title}
              date={event.date}
              location={event.location}
              context={event.context}
              issues={event.issues}
              significance={event.significance}
              body={event.body}
            />
          ))
        )}
      </div>
    </div>
  );
}
