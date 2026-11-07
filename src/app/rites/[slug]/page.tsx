import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { localizeItem } from "@/lib/translation/localize";

import { riteFactItems, riteSummaryIsFiller } from "./facts";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("RITE", slug));
}

/**
 * A rite: the facts (what it is, its tradition, where it is celebrated and by how
 * many), then its history and its liturgy. The stored subtitle said the same as the
 * first two. "Family: alexandrian", "Entry kind: liturgical_rite", "Content
 * subtype" and a second copy of the summary are gone.
 */
export default async function RiteDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await localizeItem(await getPublishedBySlug("RITE", slug));
  if (!item) notFound();
  return (
    <PublishedDetail
      item={item}
      // "Rite" over "Roman (Latin) Rite" says nothing.
      eyebrow={/\brite\b/i.test(item.title) ? null : undefined}
      showSubtitle={false}
      lede={!riteSummaryIsFiller(item.payload)}
      factItems={riteFactItems(item.payload)}
      factsInSubtitle={["Type", "Tradition", "Place"]}
      primaryFields={["history", "background"]}
    />
  );
}
