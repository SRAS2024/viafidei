import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SaveContentButton } from "@/components/profile";
import { GuidePrayers, PublishedDetail } from "@/components/ui";
import { toDisclosureItems } from "@/lib/content-shared/structured-content";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { loadPrayersForText } from "@/lib/data/prayer-sets";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("NOVENA", slug));
}

/**
 * The prayers of a novena: its own `relatedPrayers` together with the prayers
 * its days name ("Begin with the Sign of the Cross, one Our Father, one Hail
 * Mary and the Apostles' Creed"), in the order the days first name them. Each
 * opens inline from the day that names it and is listed below the days, with
 * the Latin / Greek chips. A novena whose days name no prayer and that lists
 * none has no prayer list: the Our Father, Hail Mary and Glory Be used to be
 * shown for every such novena (26 of 31), though their days never pray them.
 */
async function novenaPrayers(payload: Record<string, unknown>) {
  const dayTexts = (toDisclosureItems(payload.days) ?? []).map((d) => d.body);
  return loadPrayersForText(payload.relatedPrayers, dayTexts, { matchCase: true });
}

/**
 * A novena's page: the title, when to begin it, its introduction, then each
 * day as a dropdown ("Day 1 · All mankind, especially sinners") holding that
 * day's prayer, then the prayers the days pray. The stored subtitle repeats
 * the start date, and "Intention", "Structure: nine_days" and "Duration: 9
 * days" told the reader nothing the days do not.
 */
export default async function NovenaDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug("NOVENA", slug);
  if (!item) notFound();

  const { prayers, ordered } = await novenaPrayers(item.payload);
  const begins =
    typeof item.payload.typicalStartDate === "string" && item.payload.typicalStartDate.trim()
      ? `Begins: ${item.payload.typicalStartDate.trim()}`
      : null;

  return (
    <>
      <PublishedDetail
        item={item}
        showSubtitle={false}
        facts={[begins]}
        primaryFields={["background", "purpose", "intentions", "days"]}
        headings={{ background: null }}
        action={<SaveContentButton contentType="NOVENA" slug={slug} />}
        linkedPrayers={prayers}
      />
      <GuidePrayers prayers={prayers} heading="Prayers of this novena" ordered={ordered} />
    </>
  );
}
