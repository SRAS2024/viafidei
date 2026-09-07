import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  OfficialSourceLink,
  PublishedDetail,
  RelatedContentLinks,
  resolveRelatedLinks,
} from "@/components/ui";
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
    // The payload's cross-references are slugs; resolved here into titled
    // links so the page never prints "our-lady-of-lourdes" as text.
    const [apparitions, prayers] = await Promise.all([
      resolveRelatedLinks(
        "APPARITION",
        typeof marian.payload.associatedApparitionSlug === "string"
          ? [marian.payload.associatedApparitionSlug]
          : [],
      ),
      resolveRelatedLinks("PRAYER", marian.payload.associatedPrayers),
    ]);
    return (
      <PublishedDetail
        item={marian}
        primaryFields={["origin", "theologicalSignificance"]}
        secondaryFields={["feastDay", "region", "iconographyNotes"]}
        footer={
          apparitions.length > 0 || prayers.length > 0 ? (
            <div className="w-full">
              <RelatedContentLinks title="Apparitions" links={apparitions} />
              <RelatedContentLinks title="Prayers" links={prayers} />
            </div>
          ) : null
        }
      />
    );
  }
  const apparition = await getPublishedBySlug("APPARITION", slug);
  if (apparition) {
    const titles = await resolveRelatedLinks(
      "MARIAN_TITLE",
      typeof apparition.payload.associatedMarianTitleSlug === "string"
        ? [apparition.payload.associatedMarianTitleSlug]
        : [],
    );
    const officialUrl =
      typeof apparition.payload.officialDocumentUrl === "string"
        ? apparition.payload.officialDocumentUrl
        : null;
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
        ]}
        footer={
          titles.length > 0 || officialUrl ? (
            <div className="w-full">
              <RelatedContentLinks title="Under the title" links={titles} />
              {/* The approving document itself, as a button — not a naked URL. */}
              <OfficialSourceLink url={officialUrl} />
            </div>
          ) : null
        }
      />
    );
  }
  notFound();
}
