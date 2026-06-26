import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("SACRAMENT", slug));
}

export default async function SacramentDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("SACRAMENT", slug);
  if (!item) notFound();
  return (
    <PublishedDetail
      item={item}
      primaryFields={["theologicalOverview", "institution"]}
      secondaryFields={[
        "matterAndForm",
        "minister",
        "recipient",
        "effects",
        "preparation",
        "relatedRites",
        "catechismReferences",
      ]}
    />
  );
}
