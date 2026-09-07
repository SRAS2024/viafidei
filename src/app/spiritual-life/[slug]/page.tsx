import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PublishedDetail, RelatedContentLinks, resolveRelatedLinks } from "@/components/ui";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";

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
    // Slug lists resolved to titled links; PublishedDetail refuses to print them raw.
    const [prayers, saints] = await Promise.all([
      resolveRelatedLinks("PRAYER", practice.payload.relatedPrayers),
      resolveRelatedLinks("SAINT", practice.payload.relatedSaints),
    ]);
    return (
      <PublishedDetail
        item={practice}
        primaryFields={["instructions", "background"]}
        secondaryFields={["practiceKind", "tradition", "durationMinutes", "frequency"]}
        footer={
          prayers.length > 0 || saints.length > 0 ? (
            <div className="w-full">
              <RelatedContentLinks title="Related prayers" links={prayers} />
              <RelatedContentLinks title="Related saints" links={saints} />
            </div>
          ) : null
        }
      />
    );
  }
  // Guides moved to their own /guides tab — preserve any old links.
  const guide = await getPublishedBySlug("GUIDE", slug);
  if (guide) redirect(`/guides/${slug}`);
  notFound();
}
