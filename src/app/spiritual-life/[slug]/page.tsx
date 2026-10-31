import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { GuidePrayers, PublishedDetail } from "@/components/ui";
import { formatDurationMinutes } from "@/lib/content-shared/field-presenters";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { loadPrayerSet } from "@/lib/data/prayer-sets";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("SPIRITUAL_PRACTICE", slug));
}

/**
 * A spiritual practice: its title and subtitle ("Lectio divina · Benedictine
 * tradition", which already names the kind and the tradition), how to practise
 * it, its background, when it is kept, and the prayers it uses — in full, with
 * the Latin / Greek chips.
 */
export default async function SpiritualLifeDetailPage({ params }: Props) {
  const { slug } = await params;
  const practice = await getPublishedBySlug("SPIRITUAL_PRACTICE", slug);
  if (practice) {
    const prayers = await loadPrayerSet(practice.payload.relatedPrayers);
    const minutes = practice.payload.durationMinutes;
    return (
      <>
        <PublishedDetail
          item={practice}
          facts={[typeof minutes === "number" ? formatDurationMinutes(minutes) : null]}
          primaryFields={["instructions", "background", "frequency"]}
          headings={{ instructions: "How to practice", frequency: "When" }}
          linkedPrayers={prayers}
        />
        <GuidePrayers prayers={prayers} heading="Prayers" />
      </>
    );
  }
  // Guides moved to their own /guides tab — preserve any old links.
  const guide = await getPublishedBySlug("GUIDE", slug);
  if (guide) redirect(`/guides/${slug}`);
  notFound();
}
