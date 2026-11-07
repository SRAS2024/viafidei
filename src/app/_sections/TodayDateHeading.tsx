"use client";

import { useEffect, useState } from "react";

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
 * from the device after mount so it follows them wherever they are. Until then a
 * placeholder holds the heading's place, and a screen reader hears "Today".
 */
export function TodayDateHeading({ id }: { id: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  return (
    <h2 id={id} className="vf-section-title vf-home-date">
      {now ? (
        <time
          dateTime={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
            now.getDate(),
          ).padStart(2, "0")}`}
        >
          <span className="vf-home-date-part">{WEEKDAY_NAMES[now.getDay()]},</span>{" "}
          <span className="vf-home-date-part">
            {MONTH_NAMES[now.getMonth()]} {now.getDate()}, {now.getFullYear()}
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
