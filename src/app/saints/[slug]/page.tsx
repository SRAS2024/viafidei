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
      primaryFields={["biography"]}
      secondaryFields={[
        "feastDay",
        "patronages",
        "saintType",
        "canonizationStatus",
        "canonizationDate",
        "canonizedBy",
        "birthDate",
        "deathDate",
        "relatedPrayers",
        "relatedDevotions",
      ]}
    />
  );
}
