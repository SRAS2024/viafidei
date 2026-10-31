import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  GuidePrayers,
  PublishedDetail,
  RelatedContentLinks,
  resolveRelatedLinks,
} from "@/components/ui";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { loadPrayerSet } from "@/lib/data/prayer-sets";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("SPIRITUAL_PRACTICE", slug));
}

export default async function SpiritualLifeDetailPage({ params }: Props) {
  const { slug } = await params;
  const practice = await getPublishedBySlug("SPIRITUAL_PRACTICE", slug);
  if (practice) {
    // The practice's prayers open in place from its instructions and are listed
    // below with the Latin / Greek chips; saints stay titled links, never slugs.
    const [prayers, saints] = await Promise.all([
      loadPrayerSet(practice.payload.relatedPrayers),
      resolveRelatedLinks("SAINT", practice.payload.relatedSaints),
    ]);
    return (
      <>
        <PublishedDetail
          item={practice}
          primaryFields={["instructions", "background"]}
          secondaryFields={["practiceKind", "tradition", "durationMinutes", "frequency"]}
          linkedPrayers={prayers}
          footer={
            saints.length > 0 ? (
              <div className="w-full">
                <RelatedContentLinks title="Related saints" links={saints} />
              </div>
            ) : null
          }
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
