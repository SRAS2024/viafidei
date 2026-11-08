"use client";

import { useId, useState } from "react";

import { FactList } from "@/components/ui/FactList";
import { MetaSeparator } from "@/components/ui/MetaSeparator";
import { useVisitMoment } from "@/components/ui/useLocalToday";
import { WeekdayCycle } from "@/components/ui/WeekdayCycle";
import {
  ascensionNote,
  civilDate,
  FIRST_CALENDAR_DATE,
  LAST_CALENDAR_DATE,
  liturgicalColorLabel,
  liturgicalObligationLabel,
  liturgicalRankLabel,
  parseCivilDate,
  resolveLiturgicalDay,
} from "@/lib/content-shared/liturgical-calendar";
import { prefersEveningMass } from "@/lib/content-shared/mass-default";

import { CalendarPanelSkeleton } from "./CalendarPanelSkeleton";
import { CalendarReadings } from "./CalendarReadings";

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

/**
 * Interactive liturgical calendar.
 *
 * Defaults to the visitor's local date (device timezone) and lets them pick
 * any day to see its season, liturgical colour, lectionary cycles, and that
 * day's Mass readings, shown under it. The computed calendar is the
 * Roman Rite's for the Dioceses of the United States; when the visitor's
 * selected rite differs, an honest note points them to its proper calendar.
 *
 * A date with an evening Mass (a Saturday, or the eve of a holy day) offers both
 * Masses and shows the readings of its own, except on the visitor's current day from
 * noon, when it opens on the evening's (CalendarReadings). The day is the visit's: it
 * moves on when the visitor comes back to the page, never under someone reading it.
 */
export function LiturgicalCalendarBrowser({
  rites,
  initialRite,
  loadingLabel,
  outOfRangeLabel = "This calendar covers the years {first} to {last}.",
}: {
  rites: { value: string; label: string }[];
  initialRite: string;
  /** What a screen reader is told until the device's date has been read. */
  loadingLabel: string;
  /** What the date's hint says of a year the calendar does not cover. */
  outOfRangeLabel?: string;
}) {
  // Null until mounted, so server and client render the same initial markup, and
  // the calendar follows the day until the visitor picks one of their own.
  const visit = useVisitMoment();
  const today = visit?.day ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  // What the field holds while it is being edited, which is not yet a date to show:
  // a typed year passes through 0002, 0020 and 0202 on its way to 2027. The result
  // and its announcement wait for a whole date, and the field keeps what was typed.
  const [typed, setTyped] = useState<string | null>(null);
  const [rite, setRite] = useState(initialRite);
  const dateId = useId();
  const dateHintId = useId();
  const riteId = useId();

  const iso = picked ?? today;
  if (!iso) return <CalendarPanelSkeleton loadingLabel={loadingLabel} />;

  const date = civilDate(iso);
  // The full resolver (not `liturgicalDay`): the browser names the celebration
  // actually observed that day and its rank, which is what the readings are
  // keyed on.
  const day = resolveLiturgicalDay(date);
  const isRoman = rite === "roman";
  const riteLabel = rites.find((r) => r.value === rite)?.label ?? rite;
  const dateLine = longDate(date);
  const colors = liturgicalColorLabel(day);
  const rank = liturgicalRankLabel(day);
  const obligation = liturgicalObligationLabel(day);
  const ascension = ascensionNote(date);
  // A whole year, not a year on its way, that the calendar does not cover. Safari's year
  // takes six digits and stays where it is, so 2027 and one digit more reads 20271.
  const outOfRange = typed !== null && /^[1-9]\d{3,}-/.test(typed) && !parseCivilDate(typed);

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
            value={typed ?? iso}
            min={FIRST_CALENDAR_DATE}
            max={LAST_CALENDAR_DATE}
            aria-invalid={outOfRange || undefined}
            aria-describedby={outOfRange ? dateHintId : undefined}
            onChange={(e) => {
              setTyped(e.target.value);
              if (parseCivilDate(e.target.value)) setPicked(e.target.value);
            }}
            onBlur={() => {
              // The field goes back to the date the result shows. Emptied, it goes
              // back to today.
              if (typed === "") setPicked(null);
              setTyped(null);
            }}
            className="vf-input"
          />
          <p id={dateHintId} role="status" className="vf-fineprint vf-calendar-date-hint">
            {outOfRange
              ? outOfRangeLabel
                  .replace("{first}", FIRST_CALENDAR_DATE.slice(0, 4))
                  .replace("{last}", LAST_CALENDAR_DATE.slice(0, 4))
              : ""}
          </p>
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
          {ascension ? ` ${ascension}` : ""}
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
              value: obligation ? (
                <>
                  {rank}
                  <MetaSeparator />
                  {obligation}
                </>
              ) : (
                rank
              ),
            },
            { label: "Liturgical colour", value: colors },
            { label: "Sunday cycle", value: `Year ${day.sundayCycle}` },
            {
              label: "Weekday cycle",
              value: (
                <>
                  Year <WeekdayCycle cycle={day.weekdayCycle} />
                </>
              ),
            },
            day.isJubileeYear ? { label: "Holy Year", value: "Jubilee Year" } : null,
          ]}
        />

        {ascension ? <p className="vf-fineprint vf-calendar-note">{ascension}</p> : null}

        {/* The day's Mass readings, computed on the server from the Lectionary tables as
            its readings page computes them, with the official source on that page. */}
        <CalendarReadings
          date={iso}
          dateLine={dateLine}
          preferEvening={prefersEveningMass(iso, visit)}
          calendarNote={ascension}
        />

        {/* Always there, so that a rite chosen later is announced when its note appears:
            picking one changes nothing else on the page, and the result is still this
            calendar. */}
        <div role="status">
          {!isRoman ? (
            <p className="vf-fineprint vf-calendar-rite-note">
              This is the Roman Rite&apos;s calendar for the Dioceses of the United States. The{" "}
              {riteLabel} Rite observes its own proper calendar, which may differ in its seasons and
              feasts.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
