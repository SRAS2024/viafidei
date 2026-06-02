"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  liturgicalDay,
  usccbReadingsUrl,
  type LiturgicalDay,
} from "@/lib/content-shared/liturgical-calendar";

/**
 * Homepage "Today's Scripture Readings" block.
 *
 * The visitor's local calendar date (device timezone) is computed on the
 * client, then the day's liturgical season and lectionary cycle are shown
 * with a link to the day's official Mass readings. The full lectionary is
 * not reproduced; the readings link points to the authoritative USCCB
 * source. Computation runs after mount to keep server/client render in sync.
 */
function localCivilDate(): Date {
  const now = new Date();
  // Place the visitor's LOCAL Y-M-D at UTC midnight so the pure calendar
  // helpers (which read UTC fields) return the correct civil day.
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function LiturgicalToday() {
  const [day, setDay] = useState<LiturgicalDay | null>(null);
  const [readingsUrl, setReadingsUrl] = useState("https://bible.usccb.org/readings");

  useEffect(() => {
    const date = localCivilDate();
    setDay(liturgicalDay(date));
    setReadingsUrl(usccbReadingsUrl(date));
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
            <a
              href={readingsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="vf-btn vf-btn-primary mt-6 inline-block"
            >
              Read today&apos;s Mass readings →
            </a>
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
