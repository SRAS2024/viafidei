"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SaintSummary = {
  slug: string;
  name: string;
  biography?: string;
};

type DataState =
  | { kind: "loading" }
  | { kind: "loaded"; total: number; items: SaintSummary[]; month: number; day: number }
  | { kind: "error" };

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
 * Homepage section rendered near the bottom of /.
 *
 * Shows the current date in the user's device timezone (computed via
 * `new Date()` on the client, so it follows the user wherever they
 * are) followed by a "Today's Feast Day Saints" list of up to five
 * saints whose feast falls on that date. Saints are linked to their
 * detail page; a "See more" link below the fifth saint takes the user
 * to /saints/today with the complete feast list. Saints are returned
 * pre-ordered by `venerationRank()` in the API so the most widely
 * recognised figures land first — the ranking is not surfaced as a
 * label on the page per the spec.
 */
export function HomeToday() {
  const [state, setState] = useState<DataState>({ kind: "loading" });
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const today = new Date();
    setNow(today);
    const month = today.getMonth() + 1;
    const day = today.getDate();
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/saints/today?month=${month}&day=${day}&take=5`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          if (!cancelled) setState({ kind: "error" });
          return;
        }
        const data = (await res.json()) as {
          month: number;
          day: number;
          total: number;
          items: SaintSummary[];
        };
        if (!cancelled) {
          setState({
            kind: "loaded",
            total: data.total,
            items: data.items,
            month: data.month,
            day: data.day,
          });
        }
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dateLabel = (() => {
    if (!now) return null;
    const weekday = WEEKDAY_NAMES[now.getDay()];
    const month = MONTH_NAMES[now.getMonth()];
    return `${weekday}, ${month} ${now.getDate()}, ${now.getFullYear()}`;
  })();

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 text-center sm:px-6">
      <p className="vf-eyebrow text-ink-faint">Today</p>
      <p
        className="mt-2 font-display text-2xl text-ink sm:text-3xl"
        suppressHydrationWarning
      >
        {dateLabel ?? "Today"}
      </p>
      <div className="vf-rule mx-auto my-5" />
      <h2 className="font-display text-xl text-ink sm:text-2xl">
        Today&apos;s Feast Day Saints
      </h2>

      <div className="mt-5 min-h-[6rem]">
        {state.kind === "loading" ? (
          <p className="font-serif text-sm text-ink-faint">Loading the day&apos;s saints…</p>
        ) : state.kind === "error" ? (
          <p className="font-serif text-sm text-ink-faint">
            Could not load today&apos;s feast list.
          </p>
        ) : state.items.length === 0 ? (
          <p className="font-serif text-sm text-ink-faint">
            No saints in our catalog match today&apos;s feast yet.{" "}
            <Link href="/saints" className="vf-nav-link">
              Browse all saints
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col items-center gap-2">
            {state.items.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/saints/${s.slug}`}
                  className="font-serif text-base text-ink-soft underline-offset-4 hover:text-ink hover:underline sm:text-[0.95rem]"
                >
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {state.kind === "loaded" && state.total > state.items.length ? (
        <Link
          href={`/saints/today?month=${state.month}&day=${state.day}`}
          className="vf-nav-link mt-4 inline-block text-sm"
        >
          See more ({state.total - state.items.length} more) →
        </Link>
      ) : state.kind === "loaded" && state.total > 0 ? (
        <Link
          href={`/saints/today?month=${state.month}&day=${state.day}`}
          className="vf-nav-link mt-4 inline-block text-sm"
        >
          See full feast day list →
        </Link>
      ) : null}
    </section>
  );
}
