import type { Metadata } from "next";
import Link from "next/link";

import { ShareButton } from "@/components/ui/ShareButton";
import { prisma } from "@/lib/db/client";

import { MassChoice } from "./MassChoice";
import { ReadingSections } from "./ReadingSections";
import { TodayDateSync } from "./TodayDateSync";
import {
  buildReadingsView,
  longDate,
  parseDateParam,
  storedRowDate,
  type StoredReadingRow,
} from "./readings-view";

export const dynamic = "force-dynamic";

type SearchParams = { date?: string; variant?: string; mass?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { date: dateParam, mass } = await searchParams;
  const date = parseDateParam(dateParam);
  const view = buildReadingsView(date, { mass: mass ?? null });
  return {
    title: `${view.title} — Mass Readings`,
    description: `The Scripture readings of Holy Mass for ${longDate(date)}: ${view.title}.`,
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
  const { date: dateParam, variant, mass } = await searchParams;
  const date = parseDateParam(dateParam);

  const rowDate = storedRowDate(date, mass);
  const row = rowDate
    ? ((await prisma.dailyReading
        .findUnique({
          where: {
            date_calendar_locale: { date: rowDate, calendar: "roman-ordinary", locale: "en" },
          },
        })
        .catch(() => null)) as StoredReadingRow | null)
    : null;

  const view = buildReadingsView(date, { variant: variant ?? null, mass: mass ?? null, row });
  const { framing } = view;
  const catholicResources = view.attribution.find((a) => a.source === "catholic-resources");

  return (
    <article className="vf-detail">
      {/* A visitor who asked for "today" gets their OWN calendar date, not the
          server's UTC one. */}
      <TodayDateSync renderedDate={view.date} enabled={!dateParam} mass={mass ?? null} />

      <header className="vf-detail-header">
        <p className="vf-eyebrow">Daily Readings</p>
        <h1 className="vf-detail-title text-ink">{view.title}</h1>
        <p className="vf-detail-subtitle">{view.dateLine}</p>
        <p className="vf-reading-meta">
          {framing.seasonLabel} · Sunday Cycle {framing.sundayCycle} · Weekday Cycle{" "}
          {framing.weekdayCycle}
          {framing.isJubileeYear ? " · Jubilee Year" : ""}
        </p>
        <p className="vf-reading-meta vf-reading-meta-next">
          Liturgical colour: {framing.colorLabel}
          {view.lectionaryNumber ? ` · Lectionary: ${view.lectionaryNumber}` : ""}
        </p>
        <div className="vf-detail-actions">
          <ShareButton title={`${view.title} — ${view.dateLine}`} />
        </div>
      </header>

      {/* The Masses of this date: its own formularies (Christmas vigil, night, dawn
          and day) and its evening Mass. Links, so each Mass has its own URL. */}
      {view.masses.length > 1 || view.formularies.length > 1 || view.massNote ? (
        <div className="vf-mass-choices">
          {view.masses.length > 1 ? (
            <MassChoice label="Mass" navLabel="Masses on this date" options={view.masses} />
          ) : null}
          {view.formularies.length > 1 ? (
            <MassChoice
              label="Readings"
              navLabel="Readings of this Mass"
              options={view.formularies}
            />
          ) : null}
          {view.massNote ? <p className="vf-fineprint">{view.massNote}</p> : null}
        </div>
      ) : null}

      {!view.hasText ? (
        <p className="vf-reading-notice">
          The verified text of today&apos;s readings is not yet available in the public-domain
          translation used here. The citations are shown below; the full text is available from the
          source.
        </p>
      ) : null}

      <ReadingSections
        sections={view.sections}
        sourceUrl={view.sourceUrl}
        sourceName={view.sourceName}
      />

      <footer className="vf-detail-footer">
        <Link href="/liturgical-calendar" className="vf-link-action">
          Open the liturgical calendar →
        </Link>
      </footer>

      <div className="vf-credits vf-fineprint">
        {view.hasText ? (
          <p>
            Scripture text: the Douay-Rheims (Challoner) translation, in the public domain. The
            Lectionary&apos;s verse numbering is mapped onto the Douay-Rheims (Vulgate) numbering;
            where the Lectionary reads only part of a verse, the whole verse is shown.
          </p>
        ) : null}
        <p>
          Readings for the day:{" "}
          <a href={view.sourceUrl} target="_blank" rel="noopener noreferrer">
            {view.sourceName} →
          </a>
        </p>
        {catholicResources ? <p>{catholicResources.note}</p> : null}
      </div>
    </article>
  );
}
