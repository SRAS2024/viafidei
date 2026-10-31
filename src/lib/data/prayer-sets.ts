/**
 * The prayer lists behind the pages that show prayers with the Latin / Greek
 * chips: a guide's, a novena's, a devotion's, a Marian title's, and the prayers
 * a Rosary or chaplet prayer names. Each set is ONE query (`listPublishedBySlugs`).
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
