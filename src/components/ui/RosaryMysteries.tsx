"use client";

import { useState } from "react";

import {
  ROSARY_MYSTERY_SETS,
  daysForMysterySet,
  mysterySet,
  mysterySetForWeekday,
  type MysterySetKey,
} from "@/lib/content-shared/rosary";

import { FilterChips } from "./FilterChips";
import { useLocalToday, useVisitDay } from "./useLocalToday";

/** Noon on that date, by the device's clock, which no clock change moves to another day. */
function atNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`);
}

function setForDay(isoDate: string): MysterySetKey {
  return mysterySetForWeekday(atNoon(isoDate).getDay());
}

/**
 * The Rosary's four mystery sets with an auto-by-weekday default.
 *
 * The visitor's weekday is read only after mount, so the server and client
 * first render identically (no hydration mismatch across timezones / the
 * midnight boundary). Once mounted, the set for today's weekday — in the
 * visitor's own timezone — is selected and marked "Today"; the visitor can
 * switch to any other set. The picker is the site's filter chips, selected in
 * blue. A mystery's fruit and reading are facts, so they are set as plain text.
 * The set's name is live, so a screen reader hears which set has come up.
 *
 * What "today" says moves with the day. The set on show does not move at midnight
 * under someone praying from it: it moves when the visitor comes back to the tab, and
 * not at all once they have chosen one for themselves.
 */
export function RosaryMysteries({
  todayChip = "{label} (today)",
}: {
  /** The chip of today's set, in the reader's language: "{label} (today)". */
  todayChip?: string;
}) {
  const today = useLocalToday();
  const visitDay = useVisitDay();
  const [picked, setPicked] = useState<MysterySetKey | null>(null);

  const todaySet = today ? setForDay(today) : null;
  const selected = picked ?? (visitDay ? setForDay(visitDay) : todaySet);
  const active = selected ? mysterySet(selected) : null;

  return (
    <section className="vf-detail-section vf-mysteries">
      <h2 className="vf-subhead">The Mysteries of the Rosary</h2>
      {today && todaySet ? (
        <p className="vf-detail-note">
          Today ({atNoon(today).toLocaleDateString("en-US", { weekday: "long" })}) the{" "}
          {mysterySet(todaySet).label} are prayed.
        </p>
      ) : null}

      <FilterChips
        ariaLabel="Mystery set"
        items={ROSARY_MYSTERY_SETS.map((set) => {
          const name = set.label.replace(" Mysteries", "");
          return {
            key: set.key,
            // Words alone, since a chip's label is one string and a voice would read a dot.
            label: set.key === todaySet ? todayChip.replace("{label}", name) : name,
          };
        })}
        activeKey={selected ?? ""}
        onSelect={(key) => setPicked(key as MysterySetKey)}
        collapseAfter={ROSARY_MYSTERY_SETS.length}
        // The four sets fill the column evenly, so that none is left alone on a row.
        // How many go across is the column's to say, in the stylesheet: it follows
        // the reader's text size, as the window's width would not.
        className="vf-mysteries-picker !grid"
      />

      {active ? (
        <>
          <div aria-live="polite">
            <h3 className="vf-subhead-sm">{active.label}</h3>
            <p className="vf-detail-meta">Prayed on {daysForMysterySet(active.key)}</p>
          </div>
          {/* VoiceOver stops calling a list a list once its markers are gone. */}
          <ol role="list" className="vf-steps">
            {active.mysteries.map((m, i) => (
              <li key={m.name} className="vf-step">
                <span aria-hidden="true" className="vf-step-number">
                  {i + 1}
                </span>
                <h4 className="vf-step-title text-ink">
                  <span className="sr-only">{`Mystery ${i + 1}: `}</span>
                  {m.name}
                </h4>
                <div className="vf-step-body vf-mystery-facts">
                  <p>Fruit: {m.fruit}</p>
                  <p>
                    Meditation reading: <span translate="no">{m.scripture}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </section>
  );
}
