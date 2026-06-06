"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { liturgicalDay, type LiturgicalDay } from "@/lib/content-shared/liturgical-calendar";

/**
 * Homepage "Today's Scripture Readings" block.
 *
 * The visitor's local calendar date (device timezone) is computed on the
 * client, then the day's liturgical season and lectionary cycle are shown
 * with a link to the day's readings *inside the app* (/liturgy/readings),
 * which presents the readings and keeps the authoritative source as a
 * modest link at the bottom. Computation runs after mount to keep
 * server/client render in sync.
 */
function localCivilDate(): Date {
  const now = new Date();
  // Place the visitor's LOCAL Y-M-D at UTC midnight so the pure calendar
  // helpers (which read UTC fields) return the correct civil day.
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function LiturgicalToday() {
  const [day, setDay] = useState<LiturgicalDay | null>(null);

  useEffect(() => {
    setDay(liturgicalDay(localCivilDate()));
  }, []);

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 text-center sm:px-6">
      <p className="vf-eyebrow text-ink-faint">Today</p>
      <h2 className="mt-2 font-display text-xl text-ink sm:text-2xl">
        Today&apos;s Scripture Readings
      </h2>
      <div className="vf-rule mx-auto my-5" />
      <div className="min-h-[7rem]">
        {day ? (
          <>
            <p className="font-serif text-sm text-ink-soft">
              {day.seasonLabel} · Sunday Cycle {day.sundayCycle} · Weekday Cycle {day.weekdayCycle}
              {day.isJubileeYear ? " · Jubilee Year" : ""}
            </p>
            <p className="mt-1 font-serif text-xs text-ink-faint">Liturgical colour: {day.color}</p>
            <Link href="/liturgy/readings" className="vf-btn vf-btn-primary mt-6 inline-block">
              Read today&apos;s Mass readings →
            </Link>
            <p className="mt-4">
              <Link href="/liturgical-calendar" className="vf-nav-link text-sm">
                Open the liturgical calendar →
              </Link>
            </p>
          </>
        ) : (
          <p className="font-serif text-sm text-ink-faint">Loading today&apos;s liturgy…</p>
        )}
      </div>
    </section>
  );
}
