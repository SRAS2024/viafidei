import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  GuidePrayers,
  GuideSteps,
  RelatedContentLinks,
  RosaryMysteries,
  ShareButton,
  resolveRelatedLinks,
  type GuidePrayerData,
} from "@/components/ui";
import { isRosaryGuide } from "@/lib/content-shared/rosary";
import { guideEyebrow } from "@/lib/content-shared/guide-categories";
import { formatDurationMinutes } from "@/lib/content-shared/field-presenters";
import { toGuideSteps } from "@/lib/content-shared/structured-content";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { buildPrayerVariants } from "@/lib/content-shared/prayer-language";

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
 * generic field renderer: header (kind chip, duration, step count) → intro →
 * what you need → when to pray → OPEN numbered steps → tips → rosary mysteries
 * → the guide's prayers in prayed order → see also. Every cross-reference is
 * resolved to a real title; a raw slug never reaches the page.
 */
export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;
  const guide = await getPublishedBySlug("GUIDE", slug);
  if (!guide) notFound();

  const payload = guide.payload;

  // The guide's applicable prayers, in the order they are prayed — fetched so
  // they can be shown at the bottom as dropdowns with a universal language
  // (English / Latin / Greek) toggle, and so prayer names inside the steps
  // become inline-expandable.
  const relatedSlugs = stringList(payload, "relatedPrayers");
  const fetched = await Promise.all(relatedSlugs.map((s) => getPublishedBySlug("PRAYER", s)));
  const prayers: GuidePrayerData[] = fetched
    .map((p) =>
      p ? { slug: p.slug, title: p.title, variants: buildPrayerVariants(p.payload) } : null,
    )
    .filter((p): p is GuidePrayerData => p != null && p.variants.length > 0);

  const [devotions, practices, saints] = await Promise.all([
    resolveRelatedLinks("DEVOTION", payload.relatedDevotions),
    resolveRelatedLinks("SPIRITUAL_PRACTICE", payload.relatedPractices),
    resolveRelatedLinks("SAINT", payload.relatedSaints),
  ]);

  const steps = toGuideSteps(payload.steps) ?? [];
  const summary = stringField(payload, "summary");
  const intro = stringField(payload, "intro");
  const whenToPray = stringField(payload, "whenToPray");
  const whatYouNeed = stringList(payload, "whatYouNeed");
  const tips = stringList(payload, "tips");
  const durationMinutes =
    typeof payload.durationMinutes === "number" ? payload.durationMinutes : null;
  // "6 steps · About 20 minutes" — the duration is a chip in the header, never
  // a section headed "Duration Minutes" containing the bare number 20.
  const meta = [
    steps.length > 0 ? `${steps.length} step${steps.length === 1 ? "" : "s"}` : null,
    durationMinutes != null ? formatDurationMinutes(durationMinutes) : null,
  ].filter((m): m is string => m != null);

  return (
    <>
      <article className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="vf-eyebrow">{guideEyebrow(payload)}</p>
              <h1 className="mt-2 font-display text-4xl text-ink">{guide.title}</h1>
              {guide.subtitle ? (
                <p className="mt-1 font-serif text-base italic text-ink-soft">{guide.subtitle}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-1">
              <ShareButton title={guide.title} text={summary ?? guide.title} />
            </div>
          </div>
          {summary ? (
            <p className="mt-3 font-serif leading-relaxed text-ink-soft">{summary}</p>
          ) : null}
          {meta.length > 0 ? <p className="vf-eyebrow mt-3">{meta.join(" · ")}</p> : null}
        </header>

        {intro ? (
          <section className="mt-6">
            <p className="whitespace-pre-line font-serif leading-relaxed text-ink">{intro}</p>
          </section>
        ) : null}

        {whatYouNeed.length > 0 ? (
          <section className="mt-6">
            <h2 className="font-display text-xl text-ink">What you need</h2>
            <ul className="mt-2 ml-6 list-disc font-serif leading-relaxed text-ink">
              {whatYouNeed.map((need) => (
                <li key={need}>{need}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {whenToPray ? (
          <section className="mt-6">
            <h2 className="font-display text-xl text-ink">When to pray it</h2>
            <p className="mt-2 whitespace-pre-line font-serif leading-relaxed text-ink">
              {whenToPray}
            </p>
          </section>
        ) : null}

        {steps.length > 0 ? (
          <section className="mt-8">
            <h2 id="guide-steps" className="font-display text-xl text-ink">
              Steps
            </h2>
            <GuideSteps steps={steps} prayers={prayers} headingId="guide-steps" />
          </section>
        ) : null}

        {tips.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-display text-xl text-ink">Tips</h2>
            <ul className="mt-2 ml-6 list-disc font-serif leading-relaxed text-ink">
              {tips.map((tip) => (
                <li key={tip} className="mt-1">
                  {tip}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <RelatedContentLinks title="Related devotions" links={devotions} />
        <RelatedContentLinks title="Related practices" links={practices} />
        <RelatedContentLinks title="Related saints" links={saints} />
      </article>

      {isRosaryGuide(payload) && (
        <div className="mx-auto max-w-3xl px-4 pb-10">
          <RosaryMysteries />
        </div>
      )}
      <GuidePrayers prayers={prayers} />
    </>
  );
}
