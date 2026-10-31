import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GuidePrayers, PublishedDetail } from "@/components/ui";
import { SaveContentButton } from "@/components/profile";
import { formatDurationMinutes } from "@/lib/content-shared/field-presenters";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { loadPrayerSet } from "@/lib/data/prayer-sets";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("DEVOTION", slug));
}

/**
 * A devotion — the Rosary, the Divine Mercy Chaplet and the other chaplets
 * among them: its title, how long it takes, its background, how to pray it and
 * any indulgence, then its prayers. The prayers are the devotion itself, so they
 * are shown in full: each one named in "How to practice" opens in place, and
 * all of them are listed below as dropdowns, both with the Latin / Greek chips.
 * They used to be a row of links to other pages, which is why the Rosary and
 * the Divine Mercy Chaplet had no language toggle at all.
 */
export default async function DevotionDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("DEVOTION", slug);
  if (!item) notFound();
  const prayers = await loadPrayerSet(item.payload.relatedPrayers);
  const minutes = item.payload.durationMinutes;
  return (
    <>
      <PublishedDetail
        item={item}
        // "Devotion to Christ" / "Marian devotion · 20 min" says less than the
        // eyebrow and the duration line.
        showSubtitle={false}
        facts={[typeof minutes === "number" ? formatDurationMinutes(minutes) : null]}
        action={<SaveContentButton contentType="DEVOTION" slug={slug} />}
        primaryFields={[
          "background",
          "howToPractice",
          "practiceInstructions",
          "practiceText",
          "indulgences",
        ]}
        headings={{ background: null }}
        linkedPrayers={prayers}
      />
      <GuidePrayers prayers={prayers} heading="Prayers of this devotion" />
    </>
  );
}
