import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { SaveContentButton } from "@/components/profile";
import {
  getPublishedBySlug,
  buildPublishedMetadata,
  hiddenDuplicateSaints,
} from "@/lib/data/published";
import {
  SAINT_DUPLICATE_OF,
  saintBiographyForDisplay,
  saintDetailEyebrow,
} from "@/lib/content-shared/saints";
import { getTranslator } from "@/lib/i18n/server";
import { localizeItem } from "@/lib/translation/localize";

import { saintFactItems } from "./facts";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const metadata = buildPublishedMetadata(await getPublishedBySlug("SAINT", slug));
  // A saint published twice keeps both pages, and this one names the record the list
  // shows as the one to index. If that record is withdrawn, this page stands alone.
  const hidden = await hiddenDuplicateSaints();
  return hidden.includes(slug)
    ? { ...metadata, alternates: { canonical: `/saints/${SAINT_DUPLICATE_OF[slug]}` } }
    : metadata;
}

/**
 * A saint's page, in the owner's order: the name, then the facts (patronage, feast
 * day, the dates the saint lived), then the biography. No "Biography" heading over
 * the life, no canonization, feast-month or Wikidata rows, no sources, not even the
 * "A fuller biography is recorded in the … Wikipedia article and on Wikidata" line a
 * composed biography ends with.
 */
export default async function SaintDetailPage({ params }: Props) {
  const { slug } = await params;
  const stored = await getPublishedBySlug("SAINT", slug);
  if (!stored) notFound();
  const { t } = await getTranslator();
  // From the stored record, as on the card. The labels are the dictionaries'
  // (English until a dictionary carries them), so a machine-translated patronage
  // would put two languages in one fact.
  const factItems = saintFactItems(stored.payload, t);
  // Rendering only: the stored biography (and its record) is untouched.
  const biography = stored.payload.biography;
  const shown = typeof biography === "string" ? saintBiographyForDisplay(biography) : biography;
  const trimmed =
    shown === biography ? stored : { ...stored, payload: { ...stored.payload, biography: shown } };
  // In the reader's language (src/lib/translation), localized only once the
  // source pointer is gone, so no translation of it can reach the page. The
  // saint's name comes from the dictionaries alone and is never translated.
  const item = (await localizeItem(trimmed)) ?? trimmed;
  return (
    <PublishedDetail
      t={t}
      item={item}
      // A title the name does not carry ("Doctor of the Church", "Blessed"
      // over a beatus named without it), or nothing: "Saint" over "Saint
      // Godeberta" only repeated the first word of the name.
      eyebrow={saintDetailEyebrow(item.payload, item.title, item.slug) ?? null}
      // The stored subtitle ("Religious, patron of Noyon · Feast April 11")
      // repeats the facts below it, and the summary repeats the biography.
      showSubtitle={false}
      lede={false}
      factItems={factItems}
      action={<SaveContentButton contentType="SAINT" slug={slug} />}
      primaryFields={["biography", "background"]}
      headings={{ biography: null, background: null }}
    />
  );
}
