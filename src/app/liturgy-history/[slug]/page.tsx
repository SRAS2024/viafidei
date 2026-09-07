import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  OfficialSourceLink,
  PublishedDetail,
  RelatedContentLinks,
  resolveRelatedLinks,
} from "@/components/ui";
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
    // associatedSaintSlugs is a slug list — resolved to titled saint links.
    const saints = await resolveRelatedLinks("SAINT", liturgy.payload.associatedSaintSlugs);
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
          "associatedReadings",
        ]}
        footer={
          saints.length > 0 ? (
            <div className="w-full">
              <RelatedContentLinks title="Saints of this day" links={saints} />
            </div>
          ) : null
        }
      />
    );
  }
  const document = await getPublishedBySlug("CHURCH_DOCUMENT", slug);
  if (document) {
    // The canonical URL is the document ON vatican.va — a link, not a line of
    // text under a "Canonical Url" heading.
    const canonicalUrl =
      typeof document.payload.canonicalUrl === "string" ? document.payload.canonicalUrl : null;
    return (
      <PublishedDetail
        item={document}
        primaryFields={["bodyExcerpt", "keyThemes"]}
        secondaryFields={["documentType", "issuingAuthority", "issuedDate", "relatedDocuments"]}
        footer={
          canonicalUrl ? (
            <div className="w-full">
              <OfficialSourceLink url={canonicalUrl} label="Read the full document" />
            </div>
          ) : null
        }
      />
    );
  }
  notFound();
}
