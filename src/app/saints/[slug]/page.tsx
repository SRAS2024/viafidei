import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail, RelatedContentLinks, resolveRelatedLinks } from "@/components/ui";
import { SaveContentButton } from "@/components/profile";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { saintEyebrow } from "@/lib/content-shared/saints";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("SAINT", slug));
}

export default async function SaintDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("SAINT", slug);
  if (!item) notFound();
  // Cross-references are slug lists; resolved here so the page shows titles.
  const [prayers, devotions] = await Promise.all([
    resolveRelatedLinks("PRAYER", item.payload.relatedPrayers),
    resolveRelatedLinks("DEVOTION", item.payload.relatedDevotions),
  ]);
  return (
    <PublishedDetail
      item={item}
      // "Doctor of the Church · Feast July 25" says more than "Saint".
      eyebrow={saintEyebrow(item.payload)}
      action={<SaveContentButton contentType="SAINT" slug={slug} />}
      primaryFields={["background", "biography"]}
      secondaryFields={[
        "feastDay",
        "patronage",
        "patronages",
        "birthplace",
        "birthDate",
        "deathDate",
        "canonizationYear",
        "canonizationStatus",
        "canonizationDate",
        "canonizedBy",
      ]}
      footer={
        prayers.length > 0 || devotions.length > 0 ? (
          <div className="w-full">
            <RelatedContentLinks title="Related prayers" links={prayers} />
            <RelatedContentLinks title="Related devotions" links={devotions} />
          </div>
        ) : null
      }
    />
  );
}
