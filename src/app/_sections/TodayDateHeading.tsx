"use client";

import { useLocalToday } from "@/components/ui/useLocalToday";
import type { Locale } from "@/lib/i18n/locales";

import { todayHeadingParts } from "./today-words";

/**
 * Section II's heading: the visitor's own date ("Friday, November 6, 2026"), read
 * from the device after mount so it follows them wherever they are, and across
 * midnight. It is written in the page's language ("viernes, 6 de noviembre de
 * 2026"), so a screen reader speaking that language reads it as a date. Until then a
 * placeholder holds the heading's place, and a screen reader hears "Today".
 */
export function TodayDateHeading({
  id,
  locale = "en",
  todayLabel = "Today",
}: {
  id: string;
  locale?: Locale;
  /** What a screen reader hears before the date is known, in the page's language. */
  todayLabel?: string;
}) {
  const today = useLocalToday();
  const parts = today ? todayHeadingParts(today, locale) : null;

  return (
    <h2 id={id} className="vf-section-title vf-home-date">
      {today && parts ? (
        <time dateTime={today}>
          <span className="vf-home-date-part">{parts.first}</span>
          {parts.gap}
          <span className="vf-home-date-part">{parts.second}</span>
        </time>
      ) : (
        <>
          <span className="sr-only">{todayLabel}</span>
          <span className="vf-home-date-placeholder" aria-hidden="true">
            <span className="vf-skeleton w-[4.5em]" />
            <span className="vf-skeleton w-[8em]" />
          </span>
        </>
      )}
    </h2>
  );
}
