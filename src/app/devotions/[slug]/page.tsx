import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { SaveContentButton } from "@/components/profile";
import { getPublishedBySlug } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function DevotionDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("DEVOTION", slug);
  if (!item) notFound();
  return (
    <PublishedDetail
      item={item}
      action={<SaveContentButton contentType="DEVOTION" slug={slug} />}
      primaryFields={["background", "practiceInstructions", "practiceText"]}
      secondaryFields={[
        "devotionType",
        "subtype",
        "durationMinutes",
        "indulgences",
        "relatedPrayers",
        "relatedSaints",
      ]}
    />
  );
}
