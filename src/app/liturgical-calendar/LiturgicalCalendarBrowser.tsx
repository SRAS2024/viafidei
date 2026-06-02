"use client";

import { useEffect, useState } from "react";

import { liturgicalDay, usccbReadingsUrl } from "@/lib/content-shared/liturgical-calendar";

/**
 * Interactive liturgical calendar.
 *
 * Defaults to the visitor's local date (device timezone) and lets them pick
 * any day to see its season, liturgical colour, lectionary cycles, and a
 * link to that day's official Mass readings. The computed calendar is the
 * General Roman Calendar; when the visitor's selected rite differs, an
 * honest note points them to its proper calendar.
 */
function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toCivilDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const SWATCH: Record<string, string> = {
  White: "#f5f0e1",
  Green: "#3f6f4f",
  Violet: "#5b3a78",
  Red: "#9b2c2c",
  Rose: "#d98ca0",
};

export function LiturgicalCalendarBrowser({
  riteLabel,
  isRoman,
}: {
  riteLabel: string;
  isRoman: boolean;
}) {
  // Empty until mounted so server and client render the same initial markup.
  const [iso, setIso] = useState("");
  useEffect(() => setIso(todayIso()), []);

  if (!iso) {
    return <p className="font-serif text-sm text-ink-faint">Loading the calendar…</p>;
  }

  const date = toCivilDate(iso);
  const day = liturgicalDay(date);
  const readings = usccbReadingsUrl(date);

  return (
    <div className="vf-card rounded-sm p-6 sm:p-8">
      <label className="flex flex-col gap-1 text-sm">
        <span className="vf-eyebrow text-ink-faint">Choose a date</span>
        <input
          type="date"
          value={iso}
          onChange={(e) => setIso(e.target.value || todayIso())}
          className="rounded-sm border border-ink/20 bg-transparent px-3 py-2 font-serif text-ink"
        />
      </label>

      <div className="mt-6 flex items-center gap-3">
        <span
          aria-hidden
          className="inline-block h-5 w-5 rounded-full border border-ink/20"
          style={{ backgroundColor: SWATCH[day.color] ?? "#cccccc" }}
        />
        <p className="font-display text-2xl text-ink">{day.seasonLabel}</p>
        {day.isJubileeYear ? (
          <span className="vf-eyebrow rounded-sm border border-liturgical-gold/50 px-2 py-0.5 text-liturgical-gold">
            Jubilee Year
          </span>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 font-serif text-sm text-ink-soft">
        <dt className="font-medium text-ink">Liturgical colour</dt>
        <dd>{day.color}</dd>
        <dt className="font-medium text-ink">Sunday cycle</dt>
        <dd>Year {day.sundayCycle}</dd>
        <dt className="font-medium text-ink">Weekday cycle</dt>
        <dd>Year {day.weekdayCycle}</dd>
      </dl>

      <a
        href={readings}
        target="_blank"
        rel="noopener noreferrer"
        className="vf-btn vf-btn-primary mt-6 inline-block"
      >
        Official Mass readings for this day →
      </a>

      {!isRoman ? (
        <p className="mt-6 rounded-sm border border-ink/15 bg-ink/5 p-3 font-serif text-xs leading-relaxed text-ink-soft">
          This calendar follows the General Roman Calendar. The {riteLabel} observes its own proper
          calendar, which may differ in its seasons and feasts.
        </p>
      ) : null}
    </div>
  );
}
