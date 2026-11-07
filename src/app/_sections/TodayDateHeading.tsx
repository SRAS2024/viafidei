"use client";

import { useLocalToday } from "@/components/ui/useLocalToday";
import { civilDate } from "@/lib/content-shared/liturgical-calendar";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Section II's heading: the visitor's own date ("Friday, November 6, 2026"), read
 * from the device after mount so it follows them wherever they are, and across
 * midnight. Until then a placeholder holds the heading's place, and a screen reader
 * hears "Today".
 */
export function TodayDateHeading({ id }: { id: string }) {
  const today = useLocalToday();
  const date = today ? civilDate(today) : null;

  return (
    <h2 id={id} className="vf-section-title vf-home-date">
      {today && date ? (
        <time dateTime={today}>
          <span className="vf-home-date-part">{WEEKDAY_NAMES[date.getUTCDay()]},</span>{" "}
          <span className="vf-home-date-part">
            {MONTH_NAMES[date.getUTCMonth()]} {date.getUTCDate()}, {date.getUTCFullYear()}
          </span>
        </time>
      ) : (
        <>
          <span className="sr-only">Today</span>
          <span className="vf-home-date-placeholder" aria-hidden="true">
            <span className="vf-skeleton w-[4.5em]" />
            <span className="vf-skeleton w-[8em]" />
          </span>
        </>
      )}
    </h2>
  );
}
