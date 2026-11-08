"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ReadingSections } from "@/app/liturgy/readings/ReadingSections";
import type { ReadingsMassOption, ReadingsView } from "@/app/liturgy/readings/readings-view";
import { MetaSeparator } from "@/components/ui/MetaSeparator";

/** What /api/readings is asked for one of the Masses: its readings page address's own. */
function queryOf(href: string): string {
  const at = href.indexOf("?");
  return at === -1 ? "" : href.slice(at + 1);
}

/** The Mass the visitor pressed, for the date it was pressed on. */
interface Choice {
  date: string;
  query: string;
  label: string;
}

/**
 * One choice of Mass or of formulary, as buttons that change the readings below them.
 * The readings page links each Mass to its own address; here the readings are part of
 * the day the calendar shows, so a press shows them in place and says it is pressed.
 */
function MassToggle({
  label,
  groupLabel,
  options,
  pressed,
  onPick,
}: {
  label: string;
  groupLabel: string;
  options: ReadonlyArray<ReadingsMassOption>;
  pressed: (option: ReadingsMassOption) => boolean;
  onPick: (option: ReadingsMassOption) => void;
}) {
  return (
    <div className="vf-choice" role="group" aria-label={groupLabel}>
      <p className="vf-choice-label" aria-hidden="true">
        {label}
      </p>
      {/* Without markers Safari drops a list's role, so it is said out loud. */}
      <ul className="vf-choice-options" role="list">
        {options.map((option) => {
          const on = pressed(option);
          return (
            <li key={option.href}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onPick(option)}
                className={`vf-chip ${on ? "vf-filter-active" : ""}`.trim()}
              >
                {option.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The Mass readings of the day the calendar shows, under the day itself, so nobody has
 * to know there is a button to press to see them. A day with one Mass shows its readings;
 * a day with more (a Saturday and Sunday's Vigil, the eve of a holy day, Christmas, Holy
 * Thursday) shows them as a choice above the readings of the one chosen. That is the
 * day's own Mass, except on the visitor's current day from noon, when it is the evening's
 * (`preferEvening`); a press on another is kept until the date changes.
 *
 * The Lectionary and the Scripture text stay on the server: each Mass is asked of
 * /api/readings, which answers with what its own page would show, and is kept for the
 * visit so pressing back and forth is immediate.
 */
export function CalendarReadings({
  date,
  dateLine,
  preferEvening,
  calendarNote,
}: {
  /** The day the calendar shows, YYYY-MM-DD. */
  date: string;
  /** That day in words, which the choice's name repeats. */
  dateLine: string;
  /** The visitor's afternoon on their current day: the evening's Mass is shown first. */
  preferEvening: boolean;
  /** A note the calendar already shows beside the readings, so it is not said twice. */
  calendarNote?: string | null;
}) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [loaded, setLoaded] = useState<{ query: string; view: ReadingsView } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const cache = useRef(new Map<string, ReadingsView>());

  const picked = choice?.date === date ? choice : null;
  const query = picked ? picked.query : `date=${date}${preferEvening ? "&prefer=evening" : ""}`;

  useEffect(() => {
    const kept = cache.current.get(query);
    if (kept) {
      setLoaded({ query, view: kept });
      return;
    }
    // Asked again after failing: it is loading now, not failed.
    setFailed((last) => (last === query ? null : last));
    const controller = new AbortController();
    fetch(`/api/readings?${query}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`readings: ${res.status}`);
        return res.json() as Promise<ReadingsView>;
      })
      .then((view) => {
        cache.current.set(query, view);
        setLoaded({ query, view });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(query);
      });
    return () => controller.abort();
  }, [query]);

  // The readings of exactly what is asked for; until they come, the choice stays where
  // it is (the button just pressed keeps its place and its focus) but no other Mass's
  // readings are shown under it.
  const view = loaded?.query === query ? loaded.view : null;
  const shown = view ?? (loaded?.view.date === date ? loaded.view : null);
  const error = !view && failed === query;
  // A row the press was made in shows the press at once; any other row shows what the
  // readings shown are (the Vigil's own formularies under a press of the Vigil).
  const pressedIn =
    (options: ReadonlyArray<ReadingsMassOption>) =>
    (option: ReadingsMassOption): boolean =>
      picked && options.some((o) => queryOf(o.href) === picked.query)
        ? queryOf(option.href) === picked.query
        : option.isActive;
  const pick = (option: ReadingsMassOption) =>
    setChoice({ date, query: queryOf(option.href), label: option.label });
  const note = view?.massNote && view.massNote !== calendarNote ? view.massNote : null;

  return (
    <div className="vf-calendar-readings">
      {shown && (shown.masses.length > 1 || shown.formularies.length > 1) ? (
        <div className="vf-mass-choices">
          {shown.masses.length > 1 ? (
            <MassToggle
              label="Mass"
              groupLabel={`Mass readings for ${dateLine}`}
              options={shown.masses}
              pressed={pressedIn(shown.masses)}
              onPick={pick}
            />
          ) : null}
          {shown.formularies.length > 1 ? (
            <MassToggle
              label="Readings"
              groupLabel="Readings of this Mass"
              options={shown.formularies}
              pressed={pressedIn(shown.formularies)}
              onPick={pick}
            />
          ) : null}
        </div>
      ) : null}
      {/* After a press, which Mass's readings now stand below. A change of date is told
          by the calendar's own announcement. */}
      <p className="sr-only" role="status">
        {picked && view ? `${picked.label}: ${view.title}.` : ""}
      </p>

      {view ? (
        <>
          <p className="vf-calendar-readings-title">
            {view.title}
            {view.lectionaryNumber ? (
              <>
                <MetaSeparator />
                Lectionary {view.lectionaryNumber}
              </>
            ) : null}
          </p>
          {note ? <p className="vf-fineprint vf-calendar-readings-note">{note}</p> : null}
          {!view.hasText ? (
            <p className="vf-reading-notice">
              The verified text of these readings is not yet available in the public-domain
              translation used here. The citations are shown below; the full text is available from
              the source.
            </p>
          ) : null}
          <ReadingSections
            sections={view.sections}
            sourceUrl={view.sourceUrl}
            sourceName={view.sourceName}
            headingLevel={3}
          />
          {view.hasText ? (
            <p className="vf-fineprint vf-calendar-readings-credit">
              Scripture text: the Douay-Rheims (Challoner) translation, in the public domain.
            </p>
          ) : null}
          <p className="vf-calendar-readings-page">
            <Link href={view.href} className="vf-link-action">
              Open these readings on their own page <span aria-hidden="true">→</span>
            </Link>
          </p>
        </>
      ) : error ? (
        <p className="vf-reading-notice">
          The readings could not be loaded just now.{" "}
          <Link href={`/liturgy/readings?${query.replace("&prefer=evening", "")}`}>
            Open them on their own page
          </Link>
          .
        </p>
      ) : (
        <div aria-busy="true">
          <span className="sr-only">Loading the readings…</span>
          <div className="vf-calendar-readings-loading" aria-hidden="true">
            <span className="vf-skeleton h-6 w-3/5" />
            <span className="vf-skeleton h-7 w-40" />
            <span className="vf-skeleton h-5 w-32" />
            <span className="vf-skeleton h-24 w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
