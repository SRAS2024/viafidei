import { notFound } from "next/navigation";

import { SaveContentButton } from "@/components/profile";
import { PublishedDetail, GuidePrayers, type GuidePrayerData } from "@/components/ui";
import { getPublishedBySlug } from "@/lib/data/published";
import { buildPrayerVariants } from "@/lib/content-shared/prayer-language";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

// The prayers prayed every day of a novena (opening / closing). Shown at the
// bottom as dropdowns with the universal English / Latin / Greek toggle, so the
// full text is readily available alongside each day's own prayer.
const NOVENA_COMMON_PRAYERS = ["our-father", "hail-mary", "glory-be"];

export default async function NovenaDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("NOVENA", slug);
  if (!item) notFound();

  const related = Array.isArray(item.payload.relatedPrayers)
    ? (item.payload.relatedPrayers as unknown[]).filter((s): s is string => typeof s === "string")
    : NOVENA_COMMON_PRAYERS;
  const fetched = await Promise.all(related.map((s) => getPublishedBySlug("PRAYER", s)));
  const prayers: GuidePrayerData[] = fetched
    .map((p) =>
      p ? { slug: p.slug, title: p.title, variants: buildPrayerVariants(p.payload) } : null,
    )
    .filter((p): p is GuidePrayerData => p != null && p.variants.length > 0);

  return (
    <>
      <PublishedDetail
        item={item}
        primaryFields={["background", "purpose", "days"]}
        secondaryFields={["duration", "intentions", "intentionTheme", "typicalStartDate"]}
        action={<SaveContentButton contentType="NOVENA" slug={slug} />}
        linkedPrayers={prayers}
      />
      <GuidePrayers prayers={prayers} />
    </>
  );
}
