import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  GuidePrayers,
  PublishedDetail,
  resolveRelatedLinks,
  type RelatedLink,
} from "@/components/ui";
import { SaveContentButton } from "@/components/profile";
import {
  getPublishedBySlug,
  getAnyPublishedBySlug,
  buildPublishedMetadata,
} from "@/lib/data/published";
import { loadPrayerSet } from "@/lib/data/prayer-sets";
import { getTranslator } from "@/lib/i18n/server";
import { displayItem } from "@/lib/translation/display";
import { localizeItem, localizePrayers } from "@/lib/translation/localize";

import { apparitionFactItems, marianEyebrow, marianFactItems } from "./facts";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getAnyPublishedBySlug(slug, ["MARIAN_TITLE", "APPARITION"]));
}

/**
 * A fact that leads somewhere: a real link, blue and underlined, so it can't be
 * taken for one of the plain facts around it. A reference that does not resolve to
 * a published page has no title to print, and leaves no fact at all.
 */
function linkedFact(label: string, links: RelatedLink[]) {
  const [first] = links;
  if (!first) return null;
  return {
    label,
    value:
      links.length === 1 ? (
        <Link href={first.href} className="vf-link">
          {first.title}
        </Link>
      ) : (
        <ul className="vf-plain-list" role="list">
          {links.map((link) => (
            <li key={link.slug}>
              <Link href={link.href} className="vf-link">
                {link.title}
              </Link>
            </li>
          ))}
        </ul>
      ),
  };
}

/** The visionaries' names, one to a line: they are facts, and nothing about them is clickable. */
function visionariesFact(value: unknown) {
  const names = Array.isArray(value)
    ? value.filter((name): name is string => typeof name === "string" && !!name.trim())
    : [];
  const [first] = names;
  if (!first) return null;
  return {
    label: "Visionaries",
    value:
      names.length === 1 ? (
        first
      ) : (
        <ul className="vf-plain-list" role="list">
          {names.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      ),
  };
}

/**
 * Our Lady: a Marian title or an approved apparition. Each opens on its facts: the
 * status, place, year and visionaries of an apparition, the feast and region of a
 * title, and the page the other one is linked to. The stored subtitle said the
 * same in one line ("Church-approved Marian apparition · Lourdes, France, 1858").
 * Aliases, the worker's subtype and the approving document's source link stay out.
 */
export default async function SpiritualGuidanceDetailPage({ params }: Props) {
  const { slug } = await params;
  const { t } = await getTranslator();
  const marian = await localizeItem(await getPublishedBySlug("MARIAN_TITLE", slug));
  if (marian) {
    // The apparition cross-reference is a slug, resolved here into a titled
    // link so the page never prints "our-lady-of-lourdes" as text. The prayers
    // are shown in full, as dropdowns with the Latin / Greek chips, in the
    // reader's language (src/lib/translation).
    const [apparitions, prayers] = await Promise.all([
      resolveRelatedLinks(
        "APPARITION",
        typeof marian.payload.associatedApparitionSlug === "string"
          ? [marian.payload.associatedApparitionSlug]
          : [],
      ),
      loadPrayerSet(marian.payload.associatedPrayers).then((set) => localizePrayers(set)),
    ]);
    return (
      <>
        <PublishedDetail
          t={t}
          item={marian}
          eyebrow={marianEyebrow(marian.payload)}
          showSubtitle={false}
          factItems={[
            ...marianFactItems(marian.payload),
            linkedFact(apparitions.length === 1 ? "Apparition" : "Apparitions", apparitions),
          ]}
          factsInSubtitle={["Feast day", "Defined", "Region"]}
          primaryFields={["origin", "theologicalSignificance", "iconographyNotes"]}
          headings={{ iconographyNotes: "Iconography" }}
          linkedPrayers={prayers}
        />
        {/* A title's prayers are alternatives, not a sequence: no "Prayer 1". */}
        <GuidePrayers prayers={prayers} heading="Prayers" ordered={false} />
      </>
    );
  }
  const apparition = await localizeItem(await getPublishedBySlug("APPARITION", slug));
  if (apparition) {
    const titles = await resolveRelatedLinks(
      "MARIAN_TITLE",
      typeof apparition.payload.associatedMarianTitleSlug === "string"
        ? [apparition.payload.associatedMarianTitleSlug]
        : [],
    );
    return (
      <PublishedDetail
        t={t}
        item={apparition}
        // "Apparition" over "Apparition of Our Lady of Fatima" says nothing.
        eyebrow={/^apparitions?\b/i.test(apparition.title) ? null : undefined}
        showSubtitle={false}
        action={<SaveContentButton contentType="APPARITION" slug={slug} />}
        factItems={[
          ...apparitionFactItems(apparition.payload),
          // The names as the reader's language has them, in the stored order.
          visionariesFact(displayItem(apparition).payload.visionaries),
          linkedFact("Under the title", titles),
        ]}
        factsInSubtitle={["Status", "Place", "Year"]}
        primaryFields={["background", "messageHighlights"]}
      />
    );
  }
  notFound();
}
