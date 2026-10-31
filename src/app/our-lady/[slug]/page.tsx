import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  GuidePrayers,
  PublishedDetail,
  RelatedContentLinks,
  resolveRelatedLinks,
} from "@/components/ui";
import { SaveContentButton } from "@/components/profile";
import { formatFeastDay } from "@/lib/content-shared/saints";
import {
  getPublishedBySlug,
  getAnyPublishedBySlug,
  buildPublishedMetadata,
  type PublishedItem,
} from "@/lib/data/published";
import { loadPrayerSet } from "@/lib/data/prayer-sets";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getAnyPublishedBySlug(slug, ["MARIAN_TITLE", "APPARITION"]));
}

/**
 * "Feast day: May 13", unless the subtitle under the title already says it
 * ("Title of the Blessed Virgin Mary · Feast May 13"). A dogma's subtitle
 * ("Marian dogma · defined 1854") and an apparition's do not carry the feast.
 */
function feastLine(item: PublishedItem): string | null {
  const feast = formatFeastDay(item.payload.feastDay);
  if (!feast || item.subtitle.includes(feast)) return null;
  return `Feast day: ${feast}`;
}

/**
 * Our Lady: a Marian title or an approved apparition. The stored subtitle is
 * kept — it is the compact line a reader wants ("Church-approved Marian
 * apparition · Lourdes, France, 1858") — so the separate place, country,
 * status, year and region sections that repeated it are gone, as are aliases,
 * the worker's subtype and the approving document's source link.
 */
export default async function SpiritualGuidanceDetailPage({ params }: Props) {
  const { slug } = await params;
  const marian = await getPublishedBySlug("MARIAN_TITLE", slug);
  if (marian) {
    // The apparition cross-reference is a slug, resolved here into a titled
    // link so the page never prints "our-lady-of-lourdes" as text. The prayers
    // are shown in full, as dropdowns with the Latin / Greek chips.
    const [apparitions, prayers] = await Promise.all([
      resolveRelatedLinks(
        "APPARITION",
        typeof marian.payload.associatedApparitionSlug === "string"
          ? [marian.payload.associatedApparitionSlug]
          : [],
      ),
      loadPrayerSet(marian.payload.associatedPrayers),
    ]);
    return (
      <>
        <PublishedDetail
          item={marian}
          facts={[feastLine(marian)]}
          primaryFields={["origin", "theologicalSignificance", "iconographyNotes"]}
          headings={{ iconographyNotes: "Iconography" }}
          linkedPrayers={prayers}
          footer={
            apparitions.length > 0 ? (
              <div className="w-full">
                <RelatedContentLinks title="Apparitions" links={apparitions} />
              </div>
            ) : null
          }
        />
        {/* A title's prayers are alternatives, not a sequence: no "Prayer 1". */}
        <GuidePrayers prayers={prayers} heading="Prayers" ordered={false} />
      </>
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
    return (
      <PublishedDetail
        item={apparition}
        action={<SaveContentButton contentType="APPARITION" slug={slug} />}
        facts={[feastLine(apparition)]}
        primaryFields={["background", "visionaries", "messageHighlights"]}
        footer={
          titles.length > 0 ? (
            <div className="w-full">
              <RelatedContentLinks title="Under the title" links={titles} />
            </div>
          ) : null
        }
      />
    );
  }
  notFound();
}
