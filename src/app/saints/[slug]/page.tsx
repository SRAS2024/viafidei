import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { SaveContentButton } from "@/components/profile";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import {
  saintBiographyForDisplay,
  saintCardDetailLines,
  saintCardDetails,
  saintDetailEyebrow,
  saintLifeDates,
} from "@/lib/content-shared/saints";
import { getTranslator } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("SAINT", slug));
}

/**
 * A saint's page, in the owner's order: the name, then the patronage, then the
 * feast day, then the dates the saint lived, then the biography — and nothing
 * else. The patronage and feast lines are the catalogue card's own lines, so the
 * card and the page always agree. No "Biography" heading over the life, no
 * canonization record, no feast-month or Wikidata rows, no sources — not even
 * the "A fuller biography is recorded in the … Wikipedia article and on
 * Wikidata" line a composed biography ends with.
 */
export default async function SaintDetailPage({ params }: Props) {
  const { slug } = await params;
  const stored = await getPublishedBySlug("SAINT", slug);
  if (!stored) notFound();
  const { t } = await getTranslator();
  const facts = [
    ...saintCardDetailLines(saintCardDetails(stored.payload), t),
    saintLifeDates(stored.payload),
  ];
  // Rendering only: the stored biography (and its record) is untouched.
  const biography = stored.payload.biography;
  const shown = typeof biography === "string" ? saintBiographyForDisplay(biography) : biography;
  const item =
    shown === biography ? stored : { ...stored, payload: { ...stored.payload, biography: shown } };
  return (
    <PublishedDetail
      item={item}
      // A title the name does not carry ("Doctor of the Church", "Blessed"
      // over a beatus named without it), or nothing: "Saint" over "Saint
      // Godeberta" only repeated the first word of the name.
      eyebrow={saintDetailEyebrow(item.payload, item.title) ?? null}
      // The stored subtitle ("Religious, patron of Noyon · Feast April 11")
      // repeats the lines below it, and the summary repeats the biography.
      showSubtitle={false}
      lede={false}
      facts={facts}
      action={<SaveContentButton contentType="SAINT" slug={slug} />}
      primaryFields={["biography", "background"]}
      headings={{ biography: null, background: null }}
    />
  );
}
