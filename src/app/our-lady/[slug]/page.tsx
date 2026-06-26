import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { SaveContentButton } from "@/components/profile";
import {
  getPublishedBySlug,
  getAnyPublishedBySlug,
  buildPublishedMetadata,
} from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getAnyPublishedBySlug(slug, ["MARIAN_TITLE", "APPARITION"]));
}

export default async function SpiritualGuidanceDetailPage({ params }: Props) {
  const { slug } = await params;
  const marian = await getPublishedBySlug("MARIAN_TITLE", slug);
  if (marian) {
    return (
      <PublishedDetail
        item={marian}
        primaryFields={["origin", "theologicalSignificance"]}
        secondaryFields={[
          "feastDay",
          "region",
          "associatedApparitionSlug",
          "associatedPrayers",
          "iconographyNotes",
        ]}
      />
    );
  }
  const apparition = await getPublishedBySlug("APPARITION", slug);
  if (apparition) {
    return (
      <PublishedDetail
        item={apparition}
        action={<SaveContentButton contentType="APPARITION" slug={slug} />}
        primaryFields={["background"]}
        secondaryFields={[
          "location",
          "country",
          "approvedStatus",
          "yearOfApparition",
          "visionaries",
          "messageHighlights",
          "associatedMarianTitleSlug",
          "officialDocumentUrl",
        ]}
      />
    );
  }
  notFound();
}
