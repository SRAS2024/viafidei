import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { localizeItem } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("SACRAMENT", slug));
}

/**
 * A sacrament: what the Church teaches, its institution, matter and form,
 * minister, recipient, effects and preparation. The Catechism paragraph
 * references are sources and are no longer printed (structured data keeps
 * them); the lede is dropped automatically when it repeats the overview.
 */
export default async function SacramentDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await localizeItem(await getPublishedBySlug("SACRAMENT", slug));
  if (!item) notFound();
  return (
    <PublishedDetail
      item={item}
      primaryFields={[
        "theologicalOverview",
        "institution",
        "matterAndForm",
        "minister",
        "recipient",
        "effects",
        "preparation",
      ]}
    />
  );
}
