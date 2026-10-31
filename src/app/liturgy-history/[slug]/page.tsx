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

/**
 * A liturgical entry or a Church document. Both keep their stored subtitle —
 * "Memorial · October 7 · Ordinary Time", "Encyclical of Pope Pius XII (1954)"
 * — which already says what the rank / season / date and the document type /
 * authority / year sections used to repeat (down to "Rank: n/a"). A liturgical
 * entry is its text, its readings and the saints it keeps; a document is its
 * summary, excerpt and key themes, with a button to the full text. The related
 * documents were printed as raw slugs and are gone.
 */
export default async function LiturgyHistoryDetailPage({ params }: Props) {
  const { slug } = await params;
  const liturgy = await getPublishedBySlug("LITURGICAL", slug);
  if (liturgy) {
    // associatedSaintSlugs is a slug list — resolved to titled saint links.
    const saints = await resolveRelatedLinks("SAINT", liturgy.payload.associatedSaintSlugs);
    return (
      <PublishedDetail
        item={liturgy}
        primaryFields={["body", "associatedReadings"]}
        headings={{ body: null, associatedReadings: "Readings" }}
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
    // The canonical URL is the document ON vatican.va — the text itself, as a
    // button, not a line of text under a "Canonical Url" heading.
    const canonicalUrl =
      typeof document.payload.canonicalUrl === "string" ? document.payload.canonicalUrl : null;
    return (
      <PublishedDetail
        item={document}
        primaryFields={["bodyExcerpt", "keyThemes"]}
        footer={
          canonicalUrl ? (
            <div className="w-full">
              <OfficialSourceLink
                url={canonicalUrl}
                label="Read the full document"
                caption={null}
              />
            </div>
          ) : null
        }
      />
    );
  }
  notFound();
}
