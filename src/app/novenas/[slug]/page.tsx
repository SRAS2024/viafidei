import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SaveContentButton } from "@/components/profile";
import {
  GuidePrayers,
  PublishedDetail,
  RelatedContentLinks,
  resolveRelatedLinks,
} from "@/components/ui";
import { toDisclosureItems } from "@/lib/content-shared/structured-content";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { loadNamedPrayers, loadPrayerSet } from "@/lib/data/prayer-sets";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("NOVENA", slug));
}

// The prayers customarily prayed with every day of a novena, shown when its
// days name none of their own.
const NOVENA_COMMON_PRAYERS = ["our-father", "hail-mary", "glory-be"];

/**
 * The prayers of a novena: its own `relatedPrayers` when the payload lists
 * them, otherwise the prayers its days actually name ("Begin with the Sign of
 * the Cross, one Our Father, one Hail Mary and the Apostles' Creed"), and the
 * customary Our Father / Hail Mary / Glory Be when they name none. Each opens
 * inline from the day that names it and is listed below the days, with the
 * Latin / Greek chips.
 */
async function novenaPrayers(payload: Record<string, unknown>) {
  if (Array.isArray(payload.relatedPrayers) && payload.relatedPrayers.length > 0) {
    return loadPrayerSet(payload.relatedPrayers);
  }
  const dayTexts = (toDisclosureItems(payload.days) ?? []).map((d) => d.body);
  const named = await loadNamedPrayers(dayTexts, { matchCase: true });
  return named.length > 0 ? named : loadPrayerSet(NOVENA_COMMON_PRAYERS);
}

export default async function NovenaDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("NOVENA", slug);
  if (!item) notFound();

  const [prayers, saints] = await Promise.all([
    novenaPrayers(item.payload),
    resolveRelatedLinks("SAINT", item.payload.relatedSaints),
  ]);

  return (
    <>
      <PublishedDetail
        item={item}
        primaryFields={["background", "purpose", "days"]}
        secondaryFields={["duration", "intentions", "intentionTheme", "typicalStartDate"]}
        action={<SaveContentButton contentType="NOVENA" slug={slug} />}
        linkedPrayers={prayers}
        footer={
          saints.length > 0 ? (
            <div className="w-full">
              <RelatedContentLinks title="Related saints" links={saints} />
            </div>
          ) : null
        }
      />
      <GuidePrayers prayers={prayers} heading="Prayers of this novena" />
    </>
  );
}
