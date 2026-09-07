import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail, RelatedContentLinks, resolveRelatedLinks } from "@/components/ui";
import { SaveContentButton } from "@/components/profile";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("DEVOTION", slug));
}

export default async function DevotionDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("DEVOTION", slug);
  if (!item) notFound();
  // relatedPrayers / relatedSaints are slug lists. Resolving them here is what
  // lets PublishedDetail refuse to print them: the reader gets titled links,
  // never "our-father, hail-mary".
  const [prayers, saints] = await Promise.all([
    resolveRelatedLinks("PRAYER", item.payload.relatedPrayers),
    resolveRelatedLinks("SAINT", item.payload.relatedSaints),
  ]);
  return (
    <>
      <PublishedDetail
        item={item}
        action={<SaveContentButton contentType="DEVOTION" slug={slug} />}
        primaryFields={["background", "howToPractice", "practiceInstructions", "practiceText"]}
        secondaryFields={["origin", "audience", "durationMinutes", "indulgences"]}
        footer={
          prayers.length > 0 || saints.length > 0 ? (
            <div className="w-full">
              <RelatedContentLinks title="Related prayers" links={prayers} />
              <RelatedContentLinks title="Related saints" links={saints} />
            </div>
          ) : null
        }
      />
    </>
  );
}
