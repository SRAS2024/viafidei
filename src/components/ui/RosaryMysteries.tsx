"use client";

import { useEffect, useState } from "react";

import {
  ROSARY_MYSTERY_SETS,
  daysForMysterySet,
  mysterySet,
  mysterySetForWeekday,
  type MysterySetKey,
} from "@/lib/content-shared/rosary";

/**
 * The Rosary's four mystery sets with an auto-by-weekday default.
 *
 * The visitor's weekday is read only after mount, so the server and client
 * first render identically (no hydration mismatch across timezones / the
 * midnight boundary). Once mounted, the set for today's weekday — in the
 * visitor's own timezone — is selected and marked "Today"; the visitor can
 * switch to any other set.
 */
export function RosaryMysteries() {
  const [today, setToday] = useState<MysterySetKey | null>(null);
  const [selected, setSelected] = useState<MysterySetKey | null>(null);

  useEffect(() => {
    const t = mysterySetForWeekday(new Date().getDay());
    setToday(t);
    setSelected(t);
  }, []);

  const active = selected ? mysterySet(selected) : null;

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl text-ink">The Mysteries of the Rosary</h2>
      {today ? (
        <p className="mt-1 text-sm text-ink-soft">
          Today ({daysForMysterySet(today).split(" & ")[0] || "today"}) the{" "}
          <span className="font-medium">{mysterySet(today).label}</span> are prayed.
        </p>
      ) : null}

      <div role="group" aria-label="Mystery set" className="mt-3 flex flex-wrap gap-2">
        {ROSARY_MYSTERY_SETS.map((set) => {
          const isActive = set.key === selected;
          const isToday = set.key === today;
          return (
            <button
              key={set.key}
              type="button"
              onClick={() => setSelected(set.key)}
              aria-pressed={isActive}
              className={`vf-btn !py-1 !px-3 text-xs ${isActive ? "vf-btn-primary" : "vf-btn-ghost"}`}
            >
              {set.label.replace(" Mysteries", "")}
              {isToday ? " · Today" : ""}
            </button>
          );
        })}
      </div>

      {active ? (
        <div className="mt-4">
          <p className="vf-eyebrow">{active.label}</p>
          <p className="text-xs text-ink-faint">Prayed on {daysForMysterySet(active.key)}</p>
          <ol className="mt-3 space-y-3">
            {active.mysteries.map((m, i) => (
              <li
                key={m.name}
                className="rounded-sm border border-ink/10 bg-paper-bright/60 p-4 shadow-paper"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-lg text-ink">
                    <span className="mr-2 text-ink-faint">{i + 1}.</span>
                    {m.name}
                  </h3>
                  <span className="shrink-0 rounded-sm bg-ink/5 px-2 py-0.5 text-[11px] uppercase tracking-liturgical text-ink-soft">
                    Fruit: {m.fruit}
                  </span>
                </div>
                <p className="mt-1 font-serif text-sm text-ink-soft">
                  Meditation reading:{" "}
                  <span className="font-medium text-ink" translate="no">
                    {m.scripture}
                  </span>
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
