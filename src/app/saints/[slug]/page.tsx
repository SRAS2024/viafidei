import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { SaveContentButton } from "@/components/profile";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import {
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
 * canonization record, no feast-month or Wikidata rows, no sources.
 */
export default async function SaintDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("SAINT", slug);
  if (!item) notFound();
  const { t } = await getTranslator();
  const facts = [
    ...saintCardDetailLines(saintCardDetails(item.payload), t),
    saintLifeDates(item.payload),
  ];
  return (
    <PublishedDetail
      item={item}
      eyebrow={saintDetailEyebrow(item.payload)}
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
