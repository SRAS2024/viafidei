import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  PublishedDetail,
  RosaryMysteries,
  GuidePrayers,
  type GuidePrayerData,
} from "@/components/ui";
import { isRosaryGuide } from "@/lib/content-shared/rosary";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { buildPrayerVariants } from "@/lib/content-shared/prayer-language";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("GUIDE", slug));
}

export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;
  const guide = await getPublishedBySlug("GUIDE", slug);
  if (!guide) notFound();

  // The guide's applicable prayers, in the order they are prayed — fetched so
  // they can be shown at the bottom as dropdowns with a universal language
  // (English / Latin / Greek) toggle.
  const relatedSlugs = Array.isArray(guide.payload.relatedPrayers)
    ? (guide.payload.relatedPrayers as unknown[]).filter((s): s is string => typeof s === "string")
    : [];
  const fetched = await Promise.all(relatedSlugs.map((s) => getPublishedBySlug("PRAYER", s)));
  const prayers: GuidePrayerData[] = fetched
    .map((p) =>
      p ? { slug: p.slug, title: p.title, variants: buildPrayerVariants(p.payload) } : null,
    )
    .filter((p): p is GuidePrayerData => p != null && p.variants.length > 0);

  return (
    <>
      <PublishedDetail
        item={guide}
        primaryFields={["steps"]}
        secondaryFields={["durationMinutes"]}
        linkedPrayers={prayers}
      />
      {isRosaryGuide(guide.payload) && (
        <div className="mx-auto max-w-3xl px-4 pb-10">
          <RosaryMysteries />
        </div>
      )}
      <GuidePrayers prayers={prayers} />
    </>
  );
}
