"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { FactList } from "@/components/ui/FactList";
import {
  eveningMass,
  liturgicalColorLabel,
  liturgicalObligationLabel,
  liturgicalRankLabel,
  resolveLiturgicalDay,
} from "@/lib/content-shared/liturgical-calendar";

import { CalendarPanelSkeleton } from "./CalendarPanelSkeleton";

/**
 * Interactive liturgical calendar.
 *
 * Defaults to the visitor's local date (device timezone) and lets them pick
 * any day to see its season, liturgical colour, lectionary cycles, and a
 * link to that day's official Mass readings. The computed calendar is the
 * General Roman Calendar; when the visitor's selected rite differs, an
 * honest note points them to its proper calendar.
 *
 * A date with an evening Mass (a Saturday, or the eve of a holy day) links to both
 * Masses. Nothing here guesses from the clock which one a visitor means.
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

function longDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** The vestment colours themselves, whatever the page's theme. The name is always beside it. */
const SWATCH: Record<string, string> = {
  White: "#f5f0e1",
  Green: "#3f6f4f",
  Violet: "#5b3a78",
  Red: "#9b2c2c",
  Rose: "#d98ca0",
};

/** Persists the rite globally (same client-cookie mechanism as the settings picker). */
function persistRiteCookie(rite: string) {
  if (typeof document === "undefined") return;
  document.cookie = `vf_rite=${rite}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function LiturgicalCalendarBrowser({
  rites,
  initialRite,
}: {
  rites: { value: string; label: string }[];
  initialRite: string;
}) {
  // Empty until mounted so server and client render the same initial markup.
  const [iso, setIso] = useState("");
  const [rite, setRite] = useState(initialRite);
  const dateId = useId();
  const riteId = useId();
  useEffect(() => setIso(todayIso()), []);

  if (!iso) return <CalendarPanelSkeleton />;

  const date = toCivilDate(iso);
  // The full resolver (not `liturgicalDay`): the browser names the celebration
  // actually observed that day and its rank, which is what the readings are
  // keyed on.
  const day = resolveLiturgicalDay(date);
  const evening = eveningMass(date);
  const isRoman = rite === "roman";
  const riteLabel = rites.find((r) => r.value === rite)?.label ?? rite;
  const dateLine = longDate(date);
  const colors = liturgicalColorLabel(day);
  const obligation = liturgicalObligationLabel(day);

  return (
    <div className="vf-calendar-panel">
      <div className="vf-calendar-controls">
        <div>
          <label htmlFor={dateId} className="vf-label">
            Choose a date
          </label>
          <input
            id={dateId}
            type="date"
            value={iso}
            onChange={(e) => setIso(e.target.value || todayIso())}
            className="vf-input"
          />
        </div>
        <div>
          <label htmlFor={riteId} className="vf-label">
            Rite
          </label>
          <select
            id={riteId}
            value={rite}
            onChange={(e) => {
              setRite(e.target.value);
              persistRiteCookie(e.target.value);
            }}
            className="vf-input"
          >
            {rites.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="vf-calendar-result">
        {/* Changing the date replaces everything below; this says what it became. */}
        <p className="sr-only" role="status">
          {dateLine}: {day.celebration}. {day.seasonLabel}. Liturgical colour {colors}.
        </p>
        <div className="vf-calendar-season">
          <span
            aria-hidden="true"
            className="vf-swatch"
            style={{ backgroundColor: SWATCH[day.color] ?? "#cccccc" }}
          />
          <p className="vf-eyebrow">{day.seasonLabel}</p>
        </div>
        <h2 className="vf-calendar-title text-ink">{day.celebration}</h2>
        <p className="vf-calendar-date">{dateLine}</p>

        <FactList
          items={[
            {
              label: "Rank",
              value: obligation
                ? `${liturgicalRankLabel(day)} · ${obligation}`
                : liturgicalRankLabel(day),
            },
            { label: "Liturgical colour", value: colors },
            { label: "Sunday cycle", value: `Year ${day.sundayCycle}` },
            { label: "Weekday cycle", value: `Year ${day.weekdayCycle}` },
            day.isJubileeYear ? { label: "Holy Year", value: "Jubilee Year" } : null,
          ]}
        />

        {/* Route to the INTERNAL daily-readings page for the selected day, which
            computes that day's readings from the Lectionary tables and links out
            to the official source modestly at the bottom. */}
        <nav aria-label={`Mass readings for ${dateLine}`} className="vf-calendar-links">
          <p className="vf-label vf-calendar-links-title" aria-hidden="true">
            Mass readings
          </p>
          {/* Without markers Safari drops a list's role, so it is said out loud. */}
          <ul className="vf-calendar-links-row" role="list">
            <li>
              <Link
                href={`/liturgy/readings?date=${iso}`}
                className="vf-btn vf-btn-sm vf-btn-primary"
              >
                {evening ? evening.dayLabel : "Readings for this day"}
              </Link>
            </li>
            {evening ? (
              <li>
                <Link
                  href={`/liturgy/readings?date=${iso}&mass=vigil`}
                  className="vf-btn vf-btn-sm vf-btn-ghost"
                >
                  {evening.label}
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>

        {!isRoman ? (
          <p className="vf-fineprint vf-calendar-rite-note">
            This calendar follows the General Roman Calendar. The {riteLabel} observes its own
            proper calendar, which may differ in its seasons and feasts.
          </p>
        ) : null}
      </div>
    </div>
  );
}
