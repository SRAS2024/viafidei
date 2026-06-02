"use client";

import { useState } from "react";

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
 * On first render the set for today's weekday (in the visitor's own
 * timezone, computed client-side) is selected and marked "Today". The
 * visitor can switch to any other set; the choice is per-view, so the next
 * day the view again defaults to that day's mysteries.
 */
export function RosaryMysteries() {
  // today's weekday in the visitor's local timezone.
  const today = mysterySetForWeekday(new Date().getDay());
  const [selected, setSelected] = useState<MysterySetKey>(today);
  const active = mysterySet(selected);

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl text-ink">The Mysteries of the Rosary</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Today ({daysForMysterySet(today).split(" & ")[0] || "today"}) the{" "}
        <span className="font-medium">{mysterySet(today).label}</span> are prayed.
      </p>

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

      <div className="mt-4">
        <p className="vf-eyebrow">{active.label}</p>
        <p className="text-xs text-ink-faint">Prayed on {daysForMysterySet(active.key)}</p>
        <ol className="mt-3 ml-6 list-decimal space-y-1 font-serif leading-relaxed text-ink">
          {active.mysteries.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
