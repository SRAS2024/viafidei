/**
 * The pray-along script for a page, built from the same published records, in the
 * same reader's language, as the page itself: the text a press of the button prays is
 * the text the reader is looking at (the reader's translation once it exists, the
 * Latin or Greek when chosen), never words a request supplies.
 *
 * Server only (reads the database through the data layer).
 */

import { BUILDING_BLOCK_PRAYERS, prayersMentionedIn } from "@/lib/content-shared/prayer-mentions";
import {
  resolvePrayerLanguage,
  type PrayerWithVariants,
} from "@/lib/content-shared/prayer-language";
import { isRosaryGuide, type MysterySetKey } from "@/lib/content-shared/rosary";
import { toGuideSteps } from "@/lib/content-shared/structured-content";
import { getPublishedBySlug } from "@/lib/data/published";
import { loadPrayerSet, loadPrayersForText, publishedPrayerVariants } from "@/lib/data/prayer-sets";
import { displayItem, displayPrayerVariants } from "@/lib/translation/display";
import type { Locale } from "@/lib/i18n/locales";
import { localizeItem, localizePrayers } from "@/lib/translation/localize";

import { toAudioLang, type AudioLang } from "./languages";
import guidePlans from "./guide-plans.json";
import {
  divineMercyPrayers,
  divineMercyScript,
  novenaDayScript,
  planScript,
  quotedPassages,
  prayerScript,
  rosaryScript,
  sequenceScript,
  type PlanItem,
  type PrayAlongScript,
  type PrayerSource,
  type ScriptContext,
  type SequenceStep,
} from "./script";

export interface BuiltScript {
  /** What is being prayed, as the page names it, for the player and the lock screen. */
  title: string;
  script: PrayAlongScript;
}

/** The fields a novena day's text is stored under, in the order the page reads them. */
const DAY_BODY_KEYS = ["text", "prayer", "prayerText", "body", "content", "description", "steps"];

function dayBody(day: unknown): string | null {
  if (!day || typeof day !== "object" || Array.isArray(day)) return null;
  const o = day as Record<string, unknown>;
  for (const key of DAY_BODY_KEYS) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) return v;
    if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string")) {
      return (v as string[]).join("\n");
    }
  }
  return null;
}

function dayTitle(day: unknown, index: number): string {
  if (day && typeof day === "object" && !Array.isArray(day)) {
    const o = day as Record<string, unknown>;
    for (const key of ["title", "dayTitle", "name", "label", "heading"]) {
      const v = o[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return `Day ${index + 1}`;
}

/**
 * The reader's prayer language: the chip they chose, or Latin for a reader who reads
 * the site in Latin and chose nothing ("normally the site's current language").
 */
function effectiveChoice(chosen: string | null, pageLang: AudioLang): string | null {
  if (chosen) return chosen;
  return pageLang === "la" ? "la" : null;
}

/** The named prayers as the builders need them: shown variants plus the stored English. */
async function prayerSources(
  stored: readonly PrayerWithVariants[],
  exclude?: string,
  locale?: Locale,
): Promise<Map<string, PrayerSource>> {
  const list = stored.filter((p) => p.slug !== exclude);
  const localized = await localizePrayers(list, locale ? { locale } : {});
  const map = new Map<string, PrayerSource>();
  list.forEach((p, i) => {
    const shown = localized[i] ?? p;
    map.set(p.slug, {
      slug: p.slug,
      title: shown.title,
      variants: shown.variants,
      english: resolvePrayerLanguage(p.variants, null).vernacular?.text,
    });
  });
  return map;
}

/** Building blocks and a page's own prayers, one entry per slug. */
function mergePrayers(
  ...lists: ReadonlyArray<readonly PrayerWithVariants[]>
): PrayerWithVariants[] {
  const seen = new Map<string, PrayerWithVariants>();
  for (const list of lists) for (const p of list) if (!seen.has(p.slug)) seen.set(p.slug, p);
  return [...seen.values()];
}

/** A prayer or litany page. */
export async function scriptForPrayer(
  slug: string,
  chosen: string | null,
  pageLang: AudioLang,
  locale?: Locale,
): Promise<BuiltScript | null> {
  const stored = await getPublishedBySlug("PRAYER", slug);
  if (!stored) return null;
  const prayer = (await localizeItem(stored, locale ? { locale } : {})) ?? stored;
  const choice = effectiveChoice(chosen, pageLang);
  const storedVariants = publishedPrayerVariants(slug, stored.payload);
  const variants = displayPrayerVariants(prayer, (p) => publishedPrayerVariants(slug, p));
  const { vernacular, shown } = resolvePrayerLanguage(variants, choice);
  if (!shown) return null;
  const lang = toAudioLang(shown.lang ?? shown.code) ?? "en";
  const englishText = resolvePrayerLanguage(storedVariants, null).vernacular?.text;
  const english = shown === vernacular && lang !== "en" ? englishText : undefined;
  const blocks = await loadPrayerSet(BUILDING_BLOCK_PRAYERS);
  const ctx: ScriptContext = {
    pageLang: lang,
    chosen: choice,
    prayers: await prayerSources(blocks, slug, locale),
  };
  return {
    title: displayItem(prayer).title,
    script: prayerScript(slug, { text: shown.text, lang, english }, ctx),
  };
}

/** One day of a novena (0-based `dayIndex`). */
export async function scriptForNovenaDay(
  slug: string,
  dayIndex: number,
  chosen: string | null,
  pageLang: AudioLang,
  locale?: Locale,
): Promise<BuiltScript | null> {
  const stored = await getPublishedBySlug("NOVENA", slug);
  if (!stored) return null;
  const item = (await localizeItem(stored, locale ? { locale } : {})) ?? stored;
  const storedDays = Array.isArray(stored.payload.days) ? stored.payload.days : [];
  const shownDaysRaw = displayItem(item).payload.days;
  const shownDays = Array.isArray(shownDaysRaw) ? shownDaysRaw : storedDays;
  const englishRaw = dayBody(storedDays[dayIndex]);
  if (!englishRaw) return null;
  const shownRaw = dayBody(shownDays[dayIndex]) ?? englishRaw;
  const translated = shownRaw !== englishRaw;
  const lang: AudioLang = translated ? pageLang : "en";
  const dayTexts = storedDays.map(dayBody).filter((t): t is string => !!t);
  const [{ prayers: named }, blocks] = await Promise.all([
    loadPrayersForText(stored.payload.relatedPrayers, dayTexts, { matchCase: true }),
    loadPrayerSet(BUILDING_BLOCK_PRAYERS),
  ]);
  const ctx: ScriptContext = {
    pageLang: lang,
    chosen: effectiveChoice(chosen, pageLang),
    prayers: await prayerSources(mergePrayers(named, blocks), undefined, locale),
  };
  return {
    title: dayTitle(shownDays[dayIndex] ?? storedDays[dayIndex], dayIndex),
    script: novenaDayScript(
      { text: shownRaw, lang, english: translated ? englishRaw : undefined },
      ctx,
    ),
  };
}

/** The prayers the Rosary is made of. */
const ROSARY_PRAYERS = [
  "apostles-creed",
  "our-father",
  "hail-mary",
  "glory-be",
  "fatima-prayer",
  "salve-regina",
];

/** The whole Rosary on one set of mysteries. */
export async function scriptForRosary(
  set: MysterySetKey,
  chosen: string | null,
  pageLang: AudioLang,
  locale?: Locale,
): Promise<BuiltScript | null> {
  const prayers = await loadPrayerSet(ROSARY_PRAYERS);
  if (!prayers.some((p) => p.slug === "hail-mary")) return null;
  const ctx: ScriptContext = {
    pageLang,
    chosen: effectiveChoice(chosen, pageLang),
    prayers: await prayerSources(prayers, undefined, locale),
  };
  return { title: "The Holy Rosary", script: rosaryScript(set, ctx) };
}

/** Seasonal alternatives a guide lists beside the prayer they replace. */
const ALTERNATIVE_OF: Readonly<Record<string, string>> = { "regina-caeli": "angelus" };

/**
 * A guide's prayers in the order they are prayed: its own list, without the Sign of
 * the Cross (the audio opens and closes with it), without a prayer an earlier one
 * already prays inside itself (the Angelus's Hail Marys), and without a seasonal
 * alternative listed beside the prayer it replaces (the Regina Caeli beside the
 * Angelus).
 */
export function guideSequence(prayers: readonly PrayerWithVariants[]): SequenceStep[] {
  const steps: SequenceStep[] = [];
  const included: PrayerWithVariants[] = [];
  const slugs = new Set(prayers.map((p) => p.slug));
  for (const p of prayers) {
    if (p.slug === "sign-of-the-cross") continue;
    const alt = ALTERNATIVE_OF[p.slug];
    if (alt && slugs.has(alt)) continue;
    const insideEarlier = included.some((earlier) => {
      const text = resolvePrayerLanguage(earlier.variants, null).vernacular?.text ?? "";
      return prayersMentionedIn([text], [p], { matchCase: true }).length > 0;
    });
    if (insideEarlier) continue;
    included.push(p);
    steps.push({ slug: p.slug });
  }
  return steps;
}

/** A guide prayed through in full; a Rosary guide prays the Rosary on the set shown. */
export async function scriptForGuide(
  slug: string,
  chosen: string | null,
  pageLang: AudioLang,
  set: MysterySetKey | null,
  locale?: Locale,
): Promise<BuiltScript | null> {
  const stored = await getPublishedBySlug("GUIDE", slug);
  if (!stored) return null;
  if (isRosaryGuide(stored.payload)) {
    const rosary = await scriptForRosary(set ?? "joyful", chosen, pageLang, locale);
    return rosary ? { ...rosary, title: stored.title } : null;
  }
  const guide = (await localizeItem(stored, locale ? { locale } : {})) ?? stored;
  const title = displayItem(guide).title;
  const choice = effectiveChoice(chosen, pageLang);
  // A chaplet guide whose steps quote the Divine Mercy prayers prays the chaplet.
  const englishSteps = (toGuideSteps(stored.payload.steps) ?? []).map((s) => s.body).join("\n");
  const shownSteps = (toGuideSteps(displayItem(guide).payload.steps) ?? [])
    .map((s) => s.body)
    .join("\n");
  const blocks = await loadPrayerSet(BUILDING_BLOCK_PRAYERS);
  const listed = await loadPrayerSet(stored.payload.relatedPrayers);
  const sources = await prayerSources(mergePrayers(listed, blocks), undefined, locale);
  const ctx: ScriptContext = { pageLang, chosen: choice, prayers: sources };
  const translatedSteps = shownSteps !== englishSteps;
  const chaplet = divineMercyPrayers({
    text: translatedSteps ? shownSteps : englishSteps,
    lang: translatedSteps ? pageLang : "en",
    english: translatedSteps ? englishSteps : undefined,
  });
  // A guide with its own checked plan prays exactly that.
  const plan = (guidePlans as Record<string, PlanItem[] | undefined>)[slug];
  if (plan && plan.length > 0) {
    const english = toGuideSteps(stored.payload.steps) ?? [];
    const shown = toGuideSteps(displayItem(guide).payload.steps) ?? [];
    const quote = (step: number, index: number) => {
      const en = english[step - 1] ? quotedPassages(english[step - 1]!.body) : [];
      const enText = en[index];
      if (!enText) return null;
      const sh = shown[step - 1] ? quotedPassages(shown[step - 1]!.body) : [];
      const translated = shown[step - 1] && shown[step - 1]!.body !== english[step - 1]!.body;
      if (translated && sh.length === en.length && sh[index]) {
        return { text: sh[index]!, lang: pageLang };
      }
      return { text: enText, lang: "en" as AudioLang };
    };
    return {
      title,
      script: planScript(plan, { quote, rosarySet: set ?? "joyful", chaplet }, ctx),
    };
  }
  if (chaplet) return { title, script: divineMercyScript(chaplet, ctx) };
  return { title, script: sequenceScript(guideSequence(listed), ctx) };
}
