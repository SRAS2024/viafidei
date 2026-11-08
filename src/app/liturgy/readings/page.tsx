import type { Metadata } from "next";
import Link from "next/link";

import { ShareButton } from "@/components/ui/ShareButton";
import { MetaSeparator } from "@/components/ui/MetaSeparator";
import { WeekdayCycle } from "@/components/ui/WeekdayCycle";
import { parseCivilDate } from "@/lib/content-shared/liturgical-calendar";
import { getTranslator } from "@/lib/i18n/server";

import { loadReadingsView } from "./load-readings";
import { MassChoice } from "./MassChoice";
import { ReadingSections } from "./ReadingSections";
import { TodayDateSync } from "./TodayDateSync";
import { buildReadingsView, calendarFromParam, longDate, parseDateParam } from "./readings-view";

export const dynamic = "force-dynamic";

type SearchParams = { date?: string; variant?: string; mass?: string; ascension?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { date: dateParam, variant, mass, ascension } = await searchParams;
  const date = parseDateParam(dateParam);
  const view = buildReadingsView(date, {
    variant: variant ?? null,
    mass: mass ?? null,
    calendar: calendarFromParam(ascension),
  });
  // On a day of several Masses of its own (Christmas, Holy Thursday), the title names the
  // one shown: choosing another changes the readings, and a title that stayed the same
  // would leave the route announcer silent for a reader who cannot see the change.
  const active = view.masses.length > 1 ? view.masses.find((m) => m.isActive) : undefined;
  return {
    title: `${view.title}${active ? `, ${active.label}` : ""} — Mass Readings`,
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
  const { date: dateParam, variant, mass, ascension } = await searchParams;
  const date = parseDateParam(dateParam);
  const { t } = await getTranslator();

  const view = await loadReadingsView(date, {
    variant: variant ?? null,
    mass: mass ?? null,
    calendar: calendarFromParam(ascension),
  });
  const { framing } = view;
  const catholicResources = view.attribution.find((a) => a.source === "catholic-resources");

  return (
    <article className="vf-detail">
      {/* A visitor who named no usable date gets their OWN calendar date, not the
          server's UTC one, and on that day, from noon, the evening's Mass when no
          Mass was chosen. */}
      <TodayDateSync
        renderedDate={view.date}
        enabled={parseCivilDate(dateParam) === null}
        eveningHref={view.isVigil ? null : view.eveningHref}
        massChosen={Boolean(mass || variant || ascension)}
      />

      <header className="vf-detail-header">
        <p className="vf-eyebrow">Daily Readings</p>
        <h1 className="vf-detail-title text-ink">{view.title}</h1>
        <p className="vf-detail-subtitle">{view.dateLine}</p>
        <p className="vf-reading-meta">
          {framing.seasonLabel}
          <MetaSeparator />
          Sunday Cycle {framing.sundayCycle}
          <MetaSeparator />
          Weekday Cycle <WeekdayCycle cycle={framing.weekdayCycle as "I" | "II"} />
          {framing.isJubileeYear ? (
            <>
              <MetaSeparator />
              Jubilee Year
            </>
          ) : null}
        </p>
        <p className="vf-reading-meta vf-reading-meta-next">
          Liturgical colour: {framing.colorLabel}
          {view.lectionaryNumber ? (
            <>
              <MetaSeparator />
              Lectionary: {view.lectionaryNumber}
            </>
          ) : null}
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
            <MassChoice
              label={t("readings.mass")}
              navLabel={t("readings.massesOnDate")}
              options={view.masses}
            />
          ) : null}
          {view.formularies.length > 1 ? (
            <MassChoice
              label={t("readings.readings")}
              navLabel={t("readings.readingsOfMass")}
              options={view.formularies}
            />
          ) : null}
          {view.massNote ? <p className="vf-fineprint">{view.massNote}</p> : null}
        </div>
      ) : null}

      {!view.hasText ? (
        <p className="vf-reading-notice">
          The verified text of this day&apos;s readings is not yet available in the public-domain
          translation used here. The citations are shown below; the full text is available from the
          source.
        </p>
      ) : null}

      <ReadingSections
        sections={view.sections}
        sourceUrl={view.sourceUrl}
        sourceName={view.sourceName}
        words={{
          douayMisses: t("readings.douayMisses"),
          readItAt: t("readings.readItAt"),
          newTab: t("common.opensInNewTab"),
        }}
      />

      <footer className="vf-detail-footer">
        <Link href="/liturgical-calendar" className="vf-link-action">
          Open the liturgical calendar <span aria-hidden="true">→</span>
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
            {view.sourceName}
            <span aria-hidden="true"> ↗</span>
            <span className="sr-only"> {t("common.opensInNewTab")}</span>
          </a>
        </p>
        {catholicResources ? <p>{catholicResources.note}</p> : null}
      </div>
    </article>
  );
}
