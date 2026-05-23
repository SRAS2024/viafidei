import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { getPublishedBySlug } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function SpiritualLifeDetailPage({ params }: Props) {
  const { slug } = await params;
  const guide = await getPublishedBySlug("GUIDE", slug);
  if (guide) {
    return (
      <PublishedDetail
        item={guide}
        primaryFields={["steps"]}
        secondaryFields={["kind", "sacramentKey", "durationMinutes", "relatedPrayers"]}
      />
    );
  }
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
  notFound();
}
