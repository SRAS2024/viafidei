/**
 * The prayer lists behind the pages that show prayers with the Latin / Greek
 * chips: a guide's, a novena's, a devotion's, a Marian title's, and the prayers
 * a Rosary or chaplet prayer names. Each set is ONE memoised query
 * (`listPublishedBySlugs`); the building-block set is the same query on every page.
 */

import { buildPrayerVariants, type PrayerWithVariants } from "@/lib/content-shared/prayer-language";
import {
  BUILDING_BLOCK_PRAYERS,
  prayersMentionedIn,
  type MentionOptions,
} from "@/lib/content-shared/prayer-mentions";
import { listPublishedBySlugs } from "@/lib/data/published";

/** A payload's slug list (`relatedPrayers`, `associatedPrayers`), or []. */
function slugList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
}

/**
 * The published prayers behind `slugs`, in that order, each with its language
 * variants. Unpublished slugs and prayers with no text are dropped. Never
 * throws: a failed lookup costs the list, not the page.
 */
export async function loadPrayerSet(slugs: unknown): Promise<PrayerWithVariants[]> {
  const list = slugList(slugs);
  if (list.length === 0) return [];
  const items = await listPublishedBySlugs("PRAYER", list).catch(() => []);
  return items
    .map((p) => ({ slug: p.slug, title: p.title, variants: buildPrayerVariants(p.payload) }))
    .filter((p) => p.variants.length > 0);
}

/**
 * The building-block prayers (Sign of the Cross, Our Father, Hail Mary, …)
 * that `texts` name, in the order they are first named — minus `exclude`, the
 * prayer the text belongs to, which never links to itself.
 */
export async function loadNamedPrayers(
  texts: ReadonlyArray<string>,
  options: MentionOptions & { exclude?: string } = {},
): Promise<PrayerWithVariants[]> {
  if (!texts.some((t) => t.trim())) return [];
  // One set (and one memo entry) for every page; the exclusion is applied after.
  const blocks = (await loadPrayerSet(BUILDING_BLOCK_PRAYERS)).filter(
    (p) => p.slug !== options.exclude,
  );
  return prayersMentionedIn(texts, blocks, options);
}

/** The prayers a devotion, practice or novena prays, and whether that is their order. */
export interface PrayersForText {
  prayers: PrayerWithVariants[];
  /**
   * True when the text names every prayer listed, so the list is the order in
   * which they are prayed ("Begin with the Sign of the Cross and the Apostles'
   * Creed. Pray one Our Father …"). False when some come only from the stored
   * list, whose order is not a sequence.
   */
  ordered: boolean;
}

/**
 * The prayers a devotion, practice or novena prays: those its payload lists
 * (`relatedPrayers`) together with the building-block prayers its text names,
 * so a name in the text always opens in place and always appears in the list.
 * The Rosary's stored list never had the Sign of the Cross its instructions
 * begin with, and a novena whose listed prayers are unpublished lost the Our
 * Father its days pray.
 *
 * Ordered by the text: the prayers it names, in the order it first names them,
 * then any listed prayer it never names, in the stored order. Nothing is added
 * that neither the payload nor the text gives.
 */
export async function loadPrayersForText(
  relatedSlugs: unknown,
  texts: ReadonlyArray<string>,
  options: MentionOptions = {},
): Promise<PrayersForText> {
  const hasText = texts.some((t) => t.trim());
  const [listed, blocks] = await Promise.all([
    loadPrayerSet(relatedSlugs),
    hasText ? loadPrayerSet(BUILDING_BLOCK_PRAYERS) : Promise.resolve([]),
  ]);
  const listedSlugs = new Set(listed.map((p) => p.slug));
  const candidates = [...listed, ...blocks.filter((p) => !listedSlugs.has(p.slug))];
  const named = hasText ? prayersMentionedIn(texts, candidates, options) : [];
  const namedSlugs = new Set(named.map((p) => p.slug));
  const unnamed = listed.filter((p) => !namedSlugs.has(p.slug));
  return {
    prayers: [...named, ...unnamed],
    ordered: named.length > 0 && unnamed.length === 0,
  };
}
