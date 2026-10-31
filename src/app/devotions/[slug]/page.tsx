import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  GuidePrayers,
  PublishedDetail,
  RelatedContentLinks,
  resolveRelatedLinks,
} from "@/components/ui";
import { SaveContentButton } from "@/components/profile";
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
 * among them. Its prayers are the devotion itself, so they are shown in full:
 * each prayer named in "How to practice" opens in place, and all of them are
 * listed below as dropdowns, both with the Latin / Greek chips. They used to be
 * a row of links to other pages, which is why the Rosary and the Divine Mercy
 * Chaplet had no language toggle at all.
 */
export default async function DevotionDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("DEVOTION", slug);
  if (!item) notFound();
  // relatedSaints is a slug list. Resolving it here is what lets
  // PublishedDetail refuse to print it: the reader gets titled links, never
  // "st-dominic".
  const [prayers, saints] = await Promise.all([
    loadPrayerSet(item.payload.relatedPrayers),
    resolveRelatedLinks("SAINT", item.payload.relatedSaints),
  ]);
  return (
    <>
      <PublishedDetail
        item={item}
        action={<SaveContentButton contentType="DEVOTION" slug={slug} />}
        primaryFields={["background", "howToPractice", "practiceInstructions", "practiceText"]}
        secondaryFields={["origin", "audience", "durationMinutes", "indulgences"]}
        linkedPrayers={prayers}
        footer={
          saints.length > 0 ? (
            <div className="w-full">
              <RelatedContentLinks title="Related saints" links={saints} />
            </div>
          ) : null
        }
      />
      <GuidePrayers prayers={prayers} heading="Prayers of this devotion" />
    </>
  );
}
