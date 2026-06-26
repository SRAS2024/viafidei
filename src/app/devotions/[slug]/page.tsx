import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { SaveContentButton } from "@/components/profile";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("DEVOTION", slug));
}

export default async function DevotionDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("DEVOTION", slug);
  if (!item) notFound();
  return (
    <PublishedDetail
      item={item}
      action={<SaveContentButton contentType="DEVOTION" slug={slug} />}
      primaryFields={["background", "howToPractice", "practiceInstructions", "practiceText"]}
      secondaryFields={[
        "origin",
        "audience",
        "durationMinutes",
        "indulgences",
        "relatedPrayers",
        "relatedSaints",
      ]}
    />
  );
}
