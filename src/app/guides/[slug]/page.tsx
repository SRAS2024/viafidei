import { Fragment } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GuidePrayers, GuideSteps, RosaryMysteries, ShareButton } from "@/components/ui";
import { eyebrowClass } from "@/components/ui/eyebrow";
import { ReadingText } from "@/components/ui/GuideSteps";
import { MetaSeparator } from "@/components/ui/MetaSeparator";
import { isRosaryGuide } from "@/lib/content-shared/rosary";
import { translateDetailLabel } from "@/lib/content-shared/detail-labels";
import { guideEyebrow } from "@/lib/content-shared/guide-categories";
import { formatDurationMinutes } from "@/lib/content-shared/field-presenters";
import { toGuideSteps } from "@/lib/content-shared/structured-content";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { loadPrayerSet } from "@/lib/data/prayer-sets";
import { getTranslator } from "@/lib/i18n/server";
import { displayItem } from "@/lib/translation/display";
import { localizeItem, localizePrayers } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("GUIDE", slug));
}

function stringField(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringList(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/**
 * A guide is a how-to, so it gets a purpose-built layout rather than the
 * generic field renderer: header (kind, step count, duration) → intro → what you
 * need → when to pray → OPEN numbered steps → tips → rosary mysteries → the
 * guide's prayers in prayed order, each a dropdown with the Latin / Greek chips.
 * All of it sits in one reading column. That is the whole page: the subtitle only
 * repeated the eyebrow and the step count, and the "Related devotions / practices
 * / saints" rows were not part of praying the guide.
 */
export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;
  const guide = await localizeItem(await getPublishedBySlug("GUIDE", slug));
  if (!guide) notFound();

  const payload = guide.payload;
  // What the reader sees, in their language (src/lib/translation); slugs and
  // links keep reading the stored payload.
  const shownGuide = displayItem(guide);
  const shown = shownGuide.payload;

  // The guide's applicable prayers, in the order they are prayed — fetched in
  // one query so they can be shown at the bottom as dropdowns with the shared
  // Latin / Greek chips, and so prayer names inside the steps become
  // inline-expandable. Titles and texts in the reader's language, like the steps.
  const prayers = await localizePrayers(await loadPrayerSet(payload.relatedPrayers));
  const { t } = await getTranslator();
  // The guide's kind, from the stored record, in the reader's language.
  const eyebrow = translateDetailLabel(guideEyebrow(payload), t);

  const steps = toGuideSteps(shown.steps) ?? [];
  const summary = stringField(shown, "summary");
  const intro = stringField(shown, "intro");
  const whenToPray = stringField(shown, "whenToPray");
  const whatYouNeed = stringList(shown, "whatYouNeed");
  const tips = stringList(shown, "tips");
  const durationMinutes =
    typeof payload.durationMinutes === "number" ? payload.durationMinutes : null;
  // "6 steps · About 20 minutes" — the duration sits in the header, never in a
  // section headed "Duration Minutes" containing the bare number 20.
  const meta = [
    steps.length > 0 ? `${steps.length} step${steps.length === 1 ? "" : "s"}` : null,
    durationMinutes != null ? formatDurationMinutes(durationMinutes) : null,
  ].filter((m): m is string => m != null);

  return (
    <article className="vf-detail">
      <header className="vf-detail-header">
        {eyebrow ? <p className={eyebrowClass(eyebrow)}>{eyebrow}</p> : null}
        <h1 className="vf-detail-title text-ink">{shownGuide.title}</h1>
        {meta.length > 0 ? (
          <p className="vf-detail-meta">
            {meta.map((part, i) => (
              <Fragment key={part}>
                {i > 0 ? <MetaSeparator /> : null}
                {part}
              </Fragment>
            ))}
          </p>
        ) : null}
        <div className="vf-detail-actions">
          <ShareButton title={shownGuide.title} text={summary ?? shownGuide.title} />
        </div>
        {summary ? <p className="vf-lede">{summary}</p> : null}
      </header>

      {intro ? (
        <section className="vf-detail-section">
          <div className="vf-reading">
            <ReadingText text={intro} />
          </div>
        </section>
      ) : null}

      {whatYouNeed.length > 0 ? (
        <section className="vf-detail-section">
          <h2 className="vf-subhead">What you need</h2>
          <div className="vf-reading">
            <ul>
              {whatYouNeed.map((need, i) => (
                // By position: two items can read the same once translated.
                <li key={i}>{need}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {whenToPray ? (
        <section className="vf-detail-section">
          <h2 className="vf-subhead">When to pray it</h2>
          <div className="vf-reading">
            <ReadingText text={whenToPray} />
          </div>
        </section>
      ) : null}

      {steps.length > 0 ? (
        <section className="vf-detail-section">
          <h2 id="guide-steps" className="vf-subhead">
            Steps
          </h2>
          <GuideSteps steps={steps} prayers={prayers} headingId="guide-steps" t={t} />
        </section>
      ) : null}

      {tips.length > 0 ? (
        <section className="vf-detail-section">
          <h2 className="vf-subhead">Tips</h2>
          <div className="vf-reading">
            <ul>
              {tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {isRosaryGuide(payload) ? <RosaryMysteries todayChip={t("rosary.todayChip")} /> : null}
      <GuidePrayers prayers={prayers} />
    </article>
  );
}
