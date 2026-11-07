import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SaveContentButton } from "@/components/profile";
import { Disclosure, GuidePrayers, PublishedDetail } from "@/components/ui";
import { PRAYER_LIST_FIELD, readingField, withPrayerList } from "@/components/ui/GuideSteps";
import { PrayerLinkedText } from "@/components/ui/PrayerLinkedText";
import {
  novenaBackgroundForDisplay,
  novenaTimingFacts,
  toDisclosureItems,
} from "@/lib/content-shared/structured-content";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { getTranslator } from "@/lib/i18n/server";
import { loadPrayersForText } from "@/lib/data/prayer-sets";
import { displayItem } from "@/lib/translation/display";
import { localizeItem, localizePrayers } from "@/lib/translation/localize";

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
 * The novena with its background as the page should say it, before it is put into
 * the reader's language, so that a translation is of what is shown.
 */
function withBackgroundForDisplay<T extends { payload: Record<string, unknown> }>(item: T): T {
  const { background } = item.payload;
  if (typeof background !== "string") return item;
  return {
    ...item,
    payload: { ...item.payload, background: novenaBackgroundForDisplay(background) },
  };
}

/**
 * A novena's page, the practical material first: the title, when it begins and
 * ends, its summary, each day as a dropdown ("Day 1 · All mankind, especially
 * sinners") holding that day's prayer, the prayers the days pray, and then the
 * background. The stored subtitle repeats the start date, and "Intention",
 * "Structure: nine_days" and "Duration: 9 days" told the reader nothing the days
 * do not.
 */
export default async function NovenaDetailPage({ params }: Props) {
  const { slug } = await params;
  const stored = await getPublishedBySlug("NOVENA", slug);
  if (!stored) notFound();
  const item = await localizeItem(withBackgroundForDisplay(stored));
  if (!item) notFound();

  // Chosen from the stored days; shown in the reader's language like the
  // novena itself (src/lib/translation).
  const { prayers: named, ordered } = await novenaPrayers(item.payload);
  const prayers = await localizePrayers(named);
  const { t } = await getTranslator();

  return (
    <PublishedDetail
      t={t}
      item={withPrayerList(item, prayers)}
      showSubtitle={false}
      factItems={novenaTimingFacts(displayItem(item).payload.typicalStartDate)}
      primaryFields={["purpose", "intentions", "days", PRAYER_LIST_FIELD, "background"]}
      headings={{ [PRAYER_LIST_FIELD]: null }}
      fieldRenderers={{
        // A day is set as prayer whether or not it names one of the novena's
        // prayers, so that every novena's versicles and stanzas read the same.
        days: (value) => {
          const days = toDisclosureItems(value);
          return days ? (
            <div className="vf-disclosure-list">
              {days.map((day, i) => (
                <Disclosure key={i} title={day.title} eyebrow={day.eyebrow}>
                  <PrayerLinkedText text={day.body} prayers={prayers} matchCase />
                </Disclosure>
              ))}
            </div>
          ) : null;
        },
        background: readingField(prayers),
        [PRAYER_LIST_FIELD]: () => (
          <GuidePrayers prayers={prayers} heading="Prayers of this novena" ordered={ordered} />
        ),
      }}
      action={<SaveContentButton contentType="NOVENA" slug={slug} />}
      linkedPrayers={prayers}
    />
  );
}
