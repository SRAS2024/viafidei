import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  GuidePrayers,
  PublishedDetail,
  RelatedContentLinks,
  resolveRelatedLinks,
} from "@/components/ui";
import { PrayerText } from "@/components/ui/PrayerText";
import {
  PRAYER_LIST_FIELD,
  instructionField,
  readingField,
  withPrayerList,
} from "@/components/ui/GuideSteps";
import { SaveContentButton } from "@/components/profile";
import { formatDurationMinutes } from "@/lib/content-shared/field-presenters";
import {
  getPublishedBySlug,
  buildPublishedMetadata,
  listPublished,
  type PublishedItem,
} from "@/lib/data/published";
import { loadPrayersForText } from "@/lib/data/prayer-sets";
import { getTranslator } from "@/lib/i18n/server";
import { localizeItem, localizePrayers } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("DEVOTION", slug));
}

/** The fields that tell the reader how to pray the devotion, in page order. */
const INSTRUCTION_FIELDS = ["howToPractice", "practiceInstructions", "practiceText"] as const;

/**
 * "The Holy Rosary" → "holy rosary": the words a how-to guide for this
 * devotion has in its title ("How to Pray the Holy Rosary").
 */
function devotionName(title: string): string {
  return title
    .replace(/\([^)]*\)/g, " ")
    .replace(/^\s*(?:the\s+)?(?:devotion\s+to\s+(?:the\s+)?)?/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * The step-by-step guide to this devotion: a published guide that lists it
 * among its devotions AND names it in its title, so the Rosary leads to "How
 * to Pray the Holy Rosary" (which has the mysteries and every prayer) and not
 * to the twenty other guides that mention the Rosary in passing.
 */
async function devotionGuides(devotion: PublishedItem) {
  const name = devotionName(devotion.title);
  if (name.length < 4) return [];
  const guides = await listPublished("GUIDE").catch(() => [] as PublishedItem[]);
  const slugs = guides
    .filter(
      (g) =>
        Array.isArray(g.payload.relatedDevotions) &&
        g.payload.relatedDevotions.includes(devotion.slug) &&
        g.title.toLowerCase().includes(name),
    )
    .map((g) => g.slug);
  return resolveRelatedLinks("GUIDE", slugs);
}

/**
 * A devotion — the Rosary, the Divine Mercy Chaplet and the other chaplets
 * among them. The practical material comes first: its title, how long it takes,
 * how to pray it, then its prayers, and its background after them, with the
 * step-by-step guide when there is one. The prayers are the devotion itself, so
 * they are shown in full: each one named in "How to practice" opens in place, and
 * all of them are listed below it as dropdowns, both with the Latin / Greek chips.
 * The list holds every prayer the instructions name (the Rosary's begins with the
 * Sign of the Cross, which its stored list lacked) as well as the stored ones, in
 * the order the instructions give them.
 *
 * Eight records hold their one description in both fields, and it says what the
 * devotion is rather than how to pray it, so it is shown once.
 */
export default async function DevotionDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await localizeItem(await getPublishedBySlug("DEVOTION", slug));
  if (!item) notFound();
  const instructions = INSTRUCTION_FIELDS.map((key) => item.payload[key]).filter(
    (text): text is string => typeof text === "string",
  );
  const [{ prayers: named, ordered }, guides] = await Promise.all([
    loadPrayersForText(item.payload.relatedPrayers, instructions),
    devotionGuides(item),
  ]);
  // Chosen and ordered from the stored English above; shown in the reader's
  // language (src/lib/translation), like the instructions that name them.
  const prayers = await localizePrayers(named);
  const minutes = item.payload.durationMinutes;
  const background =
    typeof item.payload.background === "string" ? item.payload.background.trim() : null;
  const howToPray = INSTRUCTION_FIELDS.filter((key) => {
    const value = item.payload[key];
    return typeof value === "string" && value.trim() !== background;
  });
  const { t } = await getTranslator();
  const renderInstructions = instructionField(prayers, 3, t);
  // A description shown once, with nothing above it, is the page's own prose.
  const backgroundLeads = howToPray.length === 0 && prayers.length === 0;
  return (
    <PublishedDetail
      t={t}
      item={withPrayerList(item, prayers)}
      // "Devotion to Christ" / "Marian devotion · 20 min" says less than the
      // eyebrow and the duration line.
      showSubtitle={false}
      factItems={[
        typeof minutes === "number"
          ? { label: "Duration", value: formatDurationMinutes(minutes) }
          : null,
      ]}
      action={<SaveContentButton contentType="DEVOTION" slug={slug} />}
      // No "indulgences": the stored value is a source ({ claimed, citation:
      // "Enchiridion Indulgentiarum, 4th ed. …" }), so it printed a
      // "Citation" row on the page. It stays in the payload and search.
      primaryFields={[...howToPray, PRAYER_LIST_FIELD, "background"]}
      // `practiceText` is the words the devotion prays ("Immaculate Heart of
      // Mary, pray for us…"), not a second set of instructions: under the
      // shared field label it printed "How to practice" twice.
      headings={{
        background: backgroundLeads ? null : "Background",
        practiceText: "Prayer",
        [PRAYER_LIST_FIELD]: null,
      }}
      fieldRenderers={{
        howToPractice: renderInstructions,
        practiceInstructions: renderInstructions,
        practiceText: (value) =>
          typeof value === "string" ? (
            <blockquote className="vf-spoken">
              <PrayerText text={value} />
            </blockquote>
          ) : null,
        background: readingField(prayers, backgroundLeads ? 2 : 3),
        [PRAYER_LIST_FIELD]: () => (
          <GuidePrayers prayers={prayers} heading="Prayers of this devotion" ordered={ordered} />
        ),
      }}
      footer={
        guides.length > 0 ? (
          <div className="w-full">
            <RelatedContentLinks title="Guide" links={guides} />
          </div>
        ) : null
      }
    />
  );
}
