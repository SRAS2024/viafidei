"use client";

import Link from "next/link";

import { FactList } from "@/components/ui/FactList";
import { MetaSeparator } from "@/components/ui/MetaSeparator";
import { useLocalToday } from "@/components/ui/useLocalToday";
import { WeekdayCycle } from "@/components/ui/WeekdayCycle";
import {
  civilDate,
  liturgicalColorLabel,
  massHref,
  massOptions,
  resolveLiturgicalDay,
} from "@/lib/content-shared/liturgical-calendar";
import type { Locale } from "@/lib/i18n/locales";

import { SkeletonLine } from "./SkeletonLine";
import { massOptionLabel, type TodayWords } from "./today-words";

/**
 * Homepage "Today's Scripture Readings" block.
 *
 * The visitor's local calendar date (device timezone) is computed on the
 * client, then the day's liturgical season and lectionary cycle are shown
 * with a link to the day's readings *inside the app* (/liturgy/readings),
 * which presents the readings and keeps the authoritative source as a
 * modest link at the bottom. Computation runs after mount to keep
 * server/client render in sync; until then only the day's own facts are
 * placeholders, since the rest of the block is the same every day.
 */
export function LiturgicalToday({
  loadingLabel,
  words,
  locale = "en",
}: {
  loadingLabel: string;
  /** The block's labels and Mass names in the page's language (todayWords). */
  words?: TodayWords;
  locale?: Locale;
}) {
  // A label in the page's language, or the English it stands for without the words.
  const word = (key: string, english: string) => words?.[key] ?? english;
  const today = useLocalToday();
  const date = today ? civilDate(today) : null;
  const day = date ? resolveLiturgicalDay(date) : null;
  // This evening's anticipated Mass, when it has one: every Saturday but Holy
  // Saturday, and the eve of a holy day. On the Ascension's four dates, also what
  // the provinces that keep it on Thursday read.
  const others = date ? massOptions(date).slice(1) : [];

  return (
    <div className="vf-card vf-home-part vf-home-part--readings">
      <h3 className="vf-subhead">Today&apos;s Scripture Readings</h3>
      <p role="status" className="sr-only">
        {day ? "" : loadingLabel}
      </p>
      <div className="vf-home-part-body">
        <div className="vf-home-facts" aria-hidden={day ? undefined : true}>
          <FactList
            items={[
              {
                label: word("facts.season", "Season"),
                value: day ? (
                  day.isJubileeYear ? (
                    <>
                      {day.seasonLabel}
                      <MetaSeparator />
                      {word("home.today.jubileeYear", "Jubilee Year")}
                    </>
                  ) : (
                    day.seasonLabel
                  )
                ) : (
                  <SkeletonLine className="w-4/5" />
                ),
              },
              {
                label: word("home.today.sundayCycle", "Sunday cycle"),
                value: day ? day.sundayCycle : <SkeletonLine className="w-5" />,
              },
              {
                label: word("home.today.weekdayCycle", "Weekday cycle"),
                value: day ? (
                  <WeekdayCycle cycle={day.weekdayCycle} />
                ) : (
                  <SkeletonLine className="w-5" />
                ),
              },
              {
                label: word("home.today.colour", "Liturgical colour"),
                value: day ? liturgicalColorLabel(day) : <SkeletonLine className="w-1/2" />,
              },
            ]}
          />
        </div>
        <div className="vf-home-readings-go">
          {/* Carry the VISITOR's civil date to the readings page: the server
              renders in UTC, so an evening visitor in the Americas would otherwise
              be sent to tomorrow's Mass. Before mount the link names no date, and
              the readings page finds the visitor's own. */}
          <Link
            href={day ? `/liturgy/readings?date=${day.date}` : "/liturgy/readings"}
            className="vf-btn vf-btn-primary"
          >
            Read today&apos;s Mass readings
          </Link>
          {day && date
            ? others.map((mass) => (
                <Link key={mass.label} href={massHref(day.date, mass)} className="vf-link-action">
                  {massOptionLabel(mass, date, locale, words)} <span aria-hidden="true">→</span>
                </Link>
              ))
            : null}
        </div>
      </div>
      <div className="vf-home-part-actions">
        <Link href="/liturgical-calendar" className="vf-link-action">
          Open the liturgical calendar <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
