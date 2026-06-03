import { notFound, redirect } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { getPublishedBySlug } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function SpiritualLifeDetailPage({ params }: Props) {
  const { slug } = await params;
  const practice = await getPublishedBySlug("SPIRITUAL_PRACTICE", slug);
  if (practice) {
    return (
      <PublishedDetail
        item={practice}
        primaryFields={["instructions", "background"]}
        secondaryFields={[
          "practiceKind",
          "tradition",
          "durationMinutes",
          "frequency",
          "relatedPrayers",
          "relatedSaints",
        ]}
      />
    );
  }
  // Guides moved to their own /guides tab — preserve any old links.
  const guide = await getPublishedBySlug("GUIDE", slug);
  if (guide) redirect(`/guides/${slug}`);
  notFound();
}
