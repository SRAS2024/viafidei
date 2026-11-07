"use client";

import { useEffect, useState } from "react";

import {
  ROSARY_MYSTERY_SETS,
  daysForMysterySet,
  mysterySet,
  mysterySetForWeekday,
  type MysterySetKey,
} from "@/lib/content-shared/rosary";

import { FilterChips } from "./FilterChips";

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
 */
export function RosaryMysteries() {
  const [today, setToday] = useState<{ set: MysterySetKey; weekday: string } | null>(null);
  const [selected, setSelected] = useState<MysterySetKey | null>(null);

  useEffect(() => {
    const now = new Date();
    const set = mysterySetForWeekday(now.getDay());
    setToday({ set, weekday: now.toLocaleDateString("en-US", { weekday: "long" }) });
    setSelected(set);
  }, []);

  const active = selected ? mysterySet(selected) : null;

  return (
    <section className="vf-detail-section vf-mysteries">
      <h2 className="vf-subhead">The Mysteries of the Rosary</h2>
      {today ? (
        <p className="vf-detail-note">
          Today ({today.weekday}) the {mysterySet(today.set).label} are prayed.
        </p>
      ) : null}

      <FilterChips
        ariaLabel="Mystery set"
        items={ROSARY_MYSTERY_SETS.map((set) => ({
          key: set.key,
          label: `${set.label.replace(" Mysteries", "")}${set.key === today?.set ? " · Today" : ""}`,
        }))}
        activeKey={selected ?? ""}
        onSelect={(key) => setSelected(key as MysterySetKey)}
        collapseAfter={ROSARY_MYSTERY_SETS.length}
        // The four sets fill the column evenly, two by two on a phone, so that
        // none is left alone on a row.
        className="vf-mysteries-picker !grid grid-cols-2 sm:grid-cols-4"
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
