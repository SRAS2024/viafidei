import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublishedDetail, resolveRelatedLinks } from "@/components/ui";
import {
  getPublishedBySlug,
  getAnyPublishedBySlug,
  buildPublishedMetadata,
} from "@/lib/data/published";
import { localizeItem } from "@/lib/translation/localize";

import { documentFactItems, documentLinkLabel, excerptIsReadable, liturgicalLine } from "./facts";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(
    await getAnyPublishedBySlug(slug, ["LITURGICAL", "CHURCH_DOCUMENT"]),
  );
}

/**
 * The one action on a document's page: an outlined button, marked as leaving the
 * site, on the page and to a screen reader. The canonical URL is the document ON
 * vatican.va, the text itself, not a line of text under a "Canonical Url" heading.
 */
function fullTextLink(url: unknown) {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="vf-btn vf-btn-ghost">
      {documentLinkLabel(url)} <span aria-hidden="true">↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * A liturgical entry or a Church document, each opening on its facts rather than
 * the stored subtitle, which said the same in one line ("Memorial · October 7 ·
 * Ordinary Time", "Encyclical of Pope Pius XII (1954)"). A liturgical entry is its
 * text, its readings and the saints it keeps; a document is its summary, excerpt
 * and key themes, with one button to the full text. The related documents were
 * printed as raw slugs and are gone.
 */
export default async function LiturgyHistoryDetailPage({ params }: Props) {
  const { slug } = await params;
  const liturgy = await localizeItem(await getPublishedBySlug("LITURGICAL", slug));
  if (liturgy) {
    // associatedSaintSlugs is a slug list, resolved to titled saint links, so a
    // saint of the day is a fact a reader can follow.
    const saints = await resolveRelatedLinks("SAINT", liturgy.payload.associatedSaintSlugs);
    const { kind, facts } = liturgicalLine(liturgy.payload);
    return (
      <PublishedDetail
        item={liturgy}
        eyebrow={kind || undefined}
        showSubtitle={false}
        factItems={[
          ...facts,
          saints.length > 0
            ? {
                label: saints.length === 1 ? "Saint of this day" : "Saints of this day",
                value: (
                  <ul className="vf-plain-list" role="list">
                    {saints.map((saint) => (
                      <li key={saint.slug}>
                        <Link href={saint.href} className="vf-link">
                          {saint.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ),
              }
            : null,
        ]}
        factsInSubtitle={["Rank", "Date", "Season"]}
        primaryFields={["body", "associatedReadings"]}
        headings={{ body: null, associatedReadings: "Readings" }}
      />
    );
  }
  const document = await localizeItem(await getPublishedBySlug("CHURCH_DOCUMENT", slug));
  if (document) {
    return (
      <PublishedDetail
        item={document}
        showSubtitle={false}
        factItems={documentFactItems(document.payload)}
        factsInSubtitle={["Date", "Type", "Issued by"]}
        primaryFields={
          excerptIsReadable(document.payload.bodyExcerpt)
            ? ["bodyExcerpt", "keyThemes"]
            : ["keyThemes"]
        }
        footer={fullTextLink(document.payload.canonicalUrl)}
      />
    );
  }
  notFound();
}
