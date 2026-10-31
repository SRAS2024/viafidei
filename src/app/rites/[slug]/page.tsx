import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("RITE", slug));
}

/**
 * A rite: its history, its liturgy, where it is celebrated and by how many.
 * "Family: alexandrian", "Entry kind: liturgical_rite", "Content subtype" and a
 * second copy of the summary are gone.
 */
export default async function RiteDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("RITE", slug);
  if (!item) notFound();
  return (
    <PublishedDetail
      item={item}
      primaryFields={["history", "background", "region", "faithfulEstimate"]}
      headings={{ faithfulEstimate: "Faithful" }}
    />
  );
}
