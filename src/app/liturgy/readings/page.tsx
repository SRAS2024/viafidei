import type { Metadata } from "next";
import Link from "next/link";

import { ShareButton } from "@/components/ui";
import { prisma } from "@/lib/db/client";

import { ReadingSections } from "./ReadingSections";
import { TodayDateSync } from "./TodayDateSync";
import { buildReadingsView, parseDateParam, type StoredReadingRow } from "./readings-view";

export const dynamic = "force-dynamic";

function longDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

type SearchParams = { date?: string; variant?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { date: dateParam } = await searchParams;
  const date = parseDateParam(dateParam);
  const view = buildReadingsView(date);
  return {
    title: `${view.framing.celebration} — Mass Readings · Via Fidei`,
    description: `The Scripture readings of Holy Mass for ${longDate(date)}: ${view.framing.celebration}.`,
  };
}

/**
 * The daily readings page (spec: readings displayed *inside* the app, not
 * merely an external link).
 *
 * The readings are ALWAYS computed from the calendar engine + the Lectionary
 * tables, so every day of every year renders whether or not the worker has
 * been near the database. A stored DailyReading row is an overlay only, and
 * only when it is PUBLISHED and carries text — a REVIEW skeleton must never
 * shadow readings the page can compute for itself.
 */
export default async function DailyReadingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { date: dateParam, variant } = await searchParams;
  const date = parseDateParam(dateParam);

  const row = (await prisma.dailyReading
    .findUnique({
      where: { date_calendar_locale: { date, calendar: "roman-ordinary", locale: "en" } },
    })
    .catch(() => null)) as StoredReadingRow | null;

  const view = buildReadingsView(date, { variant: variant ?? null, row });
  const { framing } = view;
  const dateQuery = `date=${view.date}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      {/* A visitor who asked for "today" gets their OWN calendar date, not the
          server's UTC one. */}
      <TodayDateSync renderedDate={view.date} enabled={!dateParam} />

      <div className="text-center">
        <p className="vf-eyebrow text-ink-faint">Daily Readings</p>
        <h1 className="mt-2 font-display text-2xl text-ink sm:text-3xl">{framing.celebration}</h1>
        <p className="mt-1 font-serif text-sm text-ink-soft">{longDate(date)}</p>
        <p className="mt-2 font-serif text-sm text-ink-soft">
          {framing.seasonLabel} · Sunday Cycle {framing.sundayCycle} · Weekday Cycle{" "}
          {framing.weekdayCycle}
          {framing.isJubileeYear ? " · Jubilee Year" : ""}
        </p>
        <p className="mt-1 font-serif text-xs text-ink-faint">
          Liturgical colour: {framing.color}
          {view.lectionaryNumber ? ` · Lectionary: ${view.lectionaryNumber}` : ""}
        </p>
        <div className="mt-4 flex justify-center">
          <ShareButton
            title={`${framing.celebration} — ${longDate(date)}`}
            text={`Mass readings — ${framing.celebration}`}
          />
        </div>
        <div className="vf-rule mx-auto my-7" />
      </div>

      {/* The day's other Mass formularies (Christmas vigil/night/dawn/day, the
          Year A scrutiny readings…). Links, so each Mass has its own URL. */}
      {view.masses.length > 1 ? (
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
          <span className="vf-eyebrow text-ink-faint">Mass</span>
          {view.masses.map((mass) => (
            <Link
              key={mass.variant ?? "principal"}
              href={
                mass.variant
                  ? `/liturgy/readings?${dateQuery}&variant=${mass.variant}`
                  : `/liturgy/readings?${dateQuery}`
              }
              aria-current={mass.isActive ? "true" : undefined}
              className={`rounded-sm border px-2.5 py-1 font-serif text-xs ${
                mass.isActive
                  ? "border-ink/40 bg-ink/5 text-ink"
                  : "border-ink/15 text-ink-soft hover:border-ink/30"
              }`}
            >
              {mass.label}
            </Link>
          ))}
        </div>
      ) : null}

      {!view.hasText && (
        <div className="mb-8 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-center font-serif text-sm text-amber-900">
          The verified text of today&apos;s readings is not yet available in the public-domain
          translation used here. The citations are shown below; the full text is available from the
          source.
        </div>
      )}

      <ReadingSections sections={view.sections} />

      <footer className="mt-12 text-center">
        <div className="vf-rule mx-auto mb-5" />
        {view.hasText ? (
          <p className="font-serif text-xs leading-relaxed text-ink-faint">
            Scripture text: the Douay-Rheims (Challoner) translation, in the public domain. The
            Lectionary&apos;s verse numbering is mapped onto the Douay-Rheims (Vulgate) numbering;
            where the Lectionary reads only part of a verse, the whole verse is shown.
          </p>
        ) : null}
        <p className="mt-3 font-serif text-xs text-ink-faint">
          Readings for the day:{" "}
          <a
            href={view.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="vf-nav-link underline"
          >
            {view.sourceName} →
          </a>
        </p>
        <p className="mt-2 font-serif text-xs text-ink-faint">
          {view.attribution.find((a) => a.source === "catholic-resources")?.note}
        </p>
        <p className="mt-3">
          <Link href="/liturgical-calendar" className="vf-nav-link text-sm">
            Open the liturgical calendar →
          </Link>
        </p>
      </footer>
    </main>
  );
}
