import { prisma } from "@/lib/db/client";
import type { LiturgicalCalendarOptions } from "@/lib/content-shared/liturgical-calendar";

import {
  buildReadingsView,
  storedRowDate,
  type ReadingsView,
  type StoredReadingRow,
} from "./readings-view";

/**
 * One Mass's readings for a date, as the readings page and the calendar show them:
 * computed from the tables, with a stored PUBLISHED row laid over them when it carries
 * text (see readings-view.ts). The page and /api/readings both read through here, so
 * the calendar can never show a date otherwise than its own page does.
 *
 * `preferEvening` is the visitor's afternoon on their current day: when no Mass was
 * asked for and the date has an evening Mass beside its own, that Mass is the one shown.
 */
export async function loadReadingsView(
  date: Date,
  opts: {
    mass?: string | null;
    variant?: string | null;
    calendar?: LiturgicalCalendarOptions;
    preferEvening?: boolean;
  } = {},
): Promise<ReadingsView> {
  let mass = opts.mass ?? null;
  if (!mass && !opts.variant && opts.preferEvening) {
    const own = buildReadingsView(date, { calendar: opts.calendar });
    if (own.eveningHref) mass = "vigil";
  }
  const rowDate = storedRowDate(date, mass, opts.calendar);
  const row = rowDate
    ? ((await prisma.dailyReading
        .findUnique({
          where: {
            date_calendar_locale: { date: rowDate, calendar: "roman-ordinary", locale: "en" },
          },
        })
        .catch(() => null)) as StoredReadingRow | null)
    : null;
  return buildReadingsView(date, {
    variant: opts.variant ?? null,
    mass,
    row,
    calendar: opts.calendar,
  });
}
