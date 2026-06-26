import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import {
  getPublishedBySlug,
  getAnyPublishedBySlug,
  buildPublishedMetadata,
} from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(
    await getAnyPublishedBySlug(slug, ["LITURGICAL", "CHURCH_DOCUMENT"]),
  );
}

export default async function LiturgyHistoryDetailPage({ params }: Props) {
  const { slug } = await params;
  const liturgy = await getPublishedBySlug("LITURGICAL", slug);
  if (liturgy) {
    return (
      <PublishedDetail
        item={liturgy}
        primaryFields={["body"]}
        secondaryFields={[
          "kind",
          "rank",
          "season",
          "feastDate",
          "movableFeast",
          "associatedSaintSlugs",
          "associatedReadings",
        ]}
      />
    );
  }
  const document = await getPublishedBySlug("CHURCH_DOCUMENT", slug);
  if (document) {
    return (
      <PublishedDetail
        item={document}
        primaryFields={["bodyExcerpt", "keyThemes"]}
        secondaryFields={[
          "documentType",
          "issuingAuthority",
          "issuedDate",
          "canonicalUrl",
          "relatedDocuments",
        ]}
      />
    );
  }
  notFound();
}
