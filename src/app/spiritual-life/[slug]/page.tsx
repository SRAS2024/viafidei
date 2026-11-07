import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { GuidePrayers, PublishedDetail } from "@/components/ui";
import {
  PRAYER_LIST_FIELD,
  instructionField,
  readingField,
  withPrayerList,
} from "@/components/ui/GuideSteps";
import { formatDurationMinutes } from "@/lib/content-shared/field-presenters";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { loadPrayersForText } from "@/lib/data/prayer-sets";
import { displayItem } from "@/lib/translation/display";
import { localizeItem, localizePrayers } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("SPIRITUAL_PRACTICE", slug));
}

/**
 * The stored subtitle's first half names what kind of practice this is ("Fasting ·
 * Latin Church tradition"), unless it only says that it is one.
 */
function practiceKind(subtitle: string | null | undefined): string | undefined {
  const [kind, rest] = (subtitle ?? "").split(" · ");
  return rest && kind && kind !== "Spiritual practice" ? kind : undefined;
}

/**
 * A spiritual practice, the practical material first: its kind and title, its
 * tradition, how long it takes and when it is kept, how to practise it, the
 * prayers it uses (in full, with the Latin / Greek chips: the ones it lists and
 * the ones its instructions name, in the order the instructions give them), and
 * then its background. The tradition is a fact here because the stored subtitle
 * could only say it clumsily ("Spiritual practice · The common ascetical
 * tradition; monastic in origin tradition").
 */
export default async function SpiritualLifeDetailPage({ params }: Props) {
  const { slug } = await params;
  const practice = await localizeItem(await getPublishedBySlug("SPIRITUAL_PRACTICE", slug));
  if (practice) {
    const instructions = practice.payload.instructions;
    const { prayers: named, ordered } = await loadPrayersForText(
      practice.payload.relatedPrayers,
      typeof instructions === "string" ? [instructions] : [],
    );
    // Chosen from the stored instructions; shown in the reader's language.
    const prayers = await localizePrayers(named);
    const minutes = practice.payload.durationMinutes;
    const shown = displayItem(practice);
    const { tradition, frequency } = shown.payload;
    return (
      <PublishedDetail
        item={withPrayerList(practice, prayers)}
        eyebrow={practiceKind(shown.subtitle)}
        showSubtitle={false}
        factItems={[
          typeof tradition === "string" ? { label: "Tradition", value: tradition } : null,
          typeof minutes === "number"
            ? { label: "Duration", value: formatDurationMinutes(minutes) }
            : null,
          typeof frequency === "string" ? { label: "When", value: frequency } : null,
        ]}
        primaryFields={["instructions", PRAYER_LIST_FIELD, "background"]}
        headings={{ instructions: "How to practice", [PRAYER_LIST_FIELD]: null }}
        fieldRenderers={{
          instructions: instructionField(prayers),
          background: readingField(prayers),
          [PRAYER_LIST_FIELD]: () => (
            <GuidePrayers prayers={prayers} heading="Prayers" ordered={ordered} />
          ),
        }}
      />
    );
  }
  // Guides moved to their own /guides tab — preserve any old links.
  const guide = await getPublishedBySlug("GUIDE", slug);
  if (guide) redirect(`/guides/${slug}`);
  notFound();
}
