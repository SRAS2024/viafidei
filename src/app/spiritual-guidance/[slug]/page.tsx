import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { getPublishedBySlug } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

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
