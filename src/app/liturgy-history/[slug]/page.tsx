import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NavSection } from "@/components/layout/NavSection";
import { PublishedDetail, resolveRelatedLinks } from "@/components/ui";
import { instructionField, listedField } from "@/components/ui/GuideSteps";
import { factLabel, translateFacts } from "@/lib/content-shared/detail-labels";
import { parseSequence } from "@/lib/content-shared/structured-content";
import {
  getPublishedBySlug,
  getAnyPublishedBySlug,
  buildPublishedMetadata,
} from "@/lib/data/published";
import { getTranslator } from "@/lib/i18n/server";
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
function fullTextLink(url: unknown, newTab: string) {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="vf-btn vf-btn-ghost">
      {documentLinkLabel(url)} <span aria-hidden="true">↗</span>
      <span className="sr-only"> {newTab}</span>
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
    const { kind, facts } = liturgicalLine(liturgy.payload, liturgy.title);
    // A translated line is only as true as the stored line it was made from, and a
    // record may still carry "Order of Mass" over The Rite of Baptism.
    const storedLineHolds = facts.length > 0 || liturgy.subtitle === kind;
    const { t } = await getTranslator();
    const sequence =
      typeof liturgy.payload.body === "string" ? parseSequence(liturgy.payload.body) : null;
    return (
      <>
        <NavSection href="/liturgy" />
        <PublishedDetail
          t={t}
          item={liturgy}
          eyebrow={kind || undefined}
          showSubtitle={false}
          factItems={translateFacts(
            [
              ...facts,
              saints.length > 0
                ? {
                    label: saints.length === 1 ? "Related saint" : "Related saints",
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
            ],
            t,
          )}
          factsInSubtitle={
            storedLineHolds
              ? ["Rank", "Date", "Season"].map((label) => factLabel(label, t))
              : undefined
          }
          primaryFields={["body", "associatedReadings"]}
          headings={{ body: null, associatedReadings: "Readings" }}
          // The parts of the Mass come in turn, each named, and are numbered as parts. The
          // forms of Palm Sunday's entrance and the days of obligation are only a list:
          // nobody does them one after another, so they are not called steps.
          fieldRenderers={
            sequence
              ? { body: sequence.parts ? instructionField(undefined, 2, t) : listedField }
              : undefined
          }
        />
      </>
    );
  }
  const document = await localizeItem(await getPublishedBySlug("CHURCH_DOCUMENT", slug));
  if (document) {
    const { t } = await getTranslator();
    return (
      <>
        <NavSection href="/church-documents" />
        <PublishedDetail
          t={t}
          item={document}
          showSubtitle={false}
          factItems={translateFacts(documentFactItems(document.payload), t)}
          factsInSubtitle={["Date", "Type", "Issued by"].map((label) => factLabel(label, t))}
          primaryFields={
            excerptIsReadable(document.payload.bodyExcerpt)
              ? ["bodyExcerpt", "keyThemes"]
              : ["keyThemes"]
          }
          footer={fullTextLink(document.payload.canonicalUrl, t("common.opensInNewTab"))}
        />
      </>
    );
  }
  notFound();
}
