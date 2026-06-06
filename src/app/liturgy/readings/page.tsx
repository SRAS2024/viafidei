import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/db/client";
import {
  buildReadingFraming,
  hasAnyBody,
  mergeSections,
  type ReadingSection,
} from "@/lib/content-shared/daily-readings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today's Mass Readings · Via Fidei",
  description: "The daily Scripture readings for Holy Mass, presented within Via Fidei.",
};

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function longDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Internal daily readings page (spec: readings displayed *inside* the app,
 * not merely an external link). Shows the liturgical framing for the day
 * and the verified reading texts when the worker has published them;
 * otherwise it shows the section structure with a modest link to the
 * authoritative source at the bottom (never fabricated text).
 */
export default async function DailyReadingsPage() {
  const date = utcMidnight(new Date());
  const framing = buildReadingFraming(date);

  const row = await prisma.dailyReading
    .findUnique({
      where: { date_calendar_locale: { date, calendar: "roman-ordinary", locale: "en" } },
    })
    .catch(() => null);

  const storedSections = (row?.sections as ReadingSection[] | undefined) ?? null;
  const sections = mergeSections(framing.sections, storedSections);
  const published = row?.status === "PUBLISHED" && hasAnyBody(sections);
  const sourceUrl = row?.sourceUrl ?? framing.sourceUrl;
  const sourceName = row?.sourceName ?? framing.sourceName;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <p className="vf-eyebrow text-ink-faint">Daily Readings</p>
        <h1 className="mt-2 font-display text-2xl text-ink sm:text-3xl">{longDate(date)}</h1>
        <p className="mt-2 font-serif text-sm text-ink-soft">
          {framing.seasonLabel} · Sunday Cycle {framing.sundayCycle} · Weekday Cycle{" "}
          {framing.weekdayCycle}
          {framing.isJubileeYear ? " · Jubilee Year" : ""}
        </p>
        <p className="mt-1 font-serif text-xs text-ink-faint">Liturgical colour: {framing.color}</p>
        <div className="vf-rule mx-auto my-7" />
      </div>

      {!published && (
        <div className="mb-8 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-center font-serif text-sm text-amber-900">
          The verified reading texts for today are being prepared. The structure of today&apos;s
          readings is shown below; the full text is available from the source.
        </div>
      )}

      <div className="space-y-8">
        {sections.map((section, i) => (
          <section key={`${section.kind}-${i}`}>
            <h2 className="font-display text-lg text-ink">{section.label}</h2>
            {section.citation && (
              <p className="mt-0.5 font-serif text-sm italic text-ink-soft">{section.citation}</p>
            )}
            <div className="vf-rule my-3" />
            {section.body ? (
              <p className="whitespace-pre-line font-serif text-[1.05rem] leading-relaxed text-ink">
                {section.body}
              </p>
            ) : (
              <p className="font-serif text-sm text-ink-faint">Available from the source below.</p>
            )}
          </section>
        ))}
      </div>

      {/* Modest source link at the bottom (spec: source transparency, not a
          large primary button). */}
      <footer className="mt-12 text-center">
        <div className="vf-rule mx-auto mb-5" />
        <p className="font-serif text-xs text-ink-faint">
          Source:{" "}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="vf-nav-link underline"
          >
            {sourceName} →
          </a>
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
