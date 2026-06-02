import { notFound } from "next/navigation";

import { PublishedDetail, RosaryMysteries } from "@/components/ui";
import { isRosaryGuide } from "@/lib/content-shared/rosary";
import { getPublishedBySlug } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function SpiritualLifeDetailPage({ params }: Props) {
  const { slug } = await params;
  const guide = await getPublishedBySlug("GUIDE", slug);
  if (guide) {
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
