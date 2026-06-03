import { notFound } from "next/navigation";

import { PublishedDetail, RosaryMysteries } from "@/components/ui";
import { isRosaryGuide } from "@/lib/content-shared/rosary";
import { getPublishedBySlug } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;
  const guide = await getPublishedBySlug("GUIDE", slug);
  if (!guide) notFound();
  return (
    <>
      <PublishedDetail
        item={guide}
        primaryFields={["steps"]}
        secondaryFields={["sacramentKey", "durationMinutes", "relatedPrayers"]}
      />
      {isRosaryGuide(guide.payload) && (
        <div className="mx-auto max-w-3xl px-4 pb-10">
          <RosaryMysteries />
        </div>
      )}
    </>
  );
}
