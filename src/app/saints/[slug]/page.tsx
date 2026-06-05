import { notFound } from "next/navigation";

import { PublishedDetail } from "@/components/ui";
import { SaveContentButton } from "@/components/profile";
import { getPublishedBySlug } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function SaintDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("SAINT", slug);
  if (!item) notFound();
  return (
    <PublishedDetail
      item={item}
      action={<SaveContentButton contentType="SAINT" slug={slug} />}
      primaryFields={["background", "biography"]}
      secondaryFields={[
        "feastDay",
        "patronage",
        "patronages",
        "birthplace",
        "birthDate",
        "deathDate",
        "canonizationYear",
        "canonizationStatus",
        "canonizationDate",
        "canonizedBy",
        "relatedPrayers",
        "relatedDevotions",
      ]}
    />
  );
}
