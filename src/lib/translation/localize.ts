/**
 * Request-time localization of published content.
 *
 * `localizeItems` is what the data layer calls on the items it returns. For
 * a visitor reading one of the ten machine-translation languages it looks up
 * every translatable unit of those items in the translation cache (one
 * indexed query behind an in-process LRU), attaches a display overlay with
 * whatever is translated, and files the rest as demand for the translator.
 * It never waits for a model and never throws: anything not translated yet is
 * shown as published.
 *
 * `localizeParishes` applies rule (b) to parish names for EVERY visitor,
 * English included: a name in a script the visitor does not read is shown
 * translated or transliterated, always with the original beside it.
 */

import { getDictionary } from "@/lib/i18n/translator";
import type { Locale } from "@/lib/i18n/locales";

import { attachDisplay, type DisplayOverlay } from "./display";
import {
  hasContentModel,
  isMtLocale,
  isSiteLocale,
  nameTargetFor,
  type MtLocale,
} from "./languages";
import { romanize } from "./romanize";
import { decideParishName, isPersonContentType, verifyProtectedSpans, withOriginal } from "./rules";
import {
  assembleItem,
  planItem,
  unitHash,
  type PlanDepth,
  type PlannableItem,
  type Unit,
} from "./segments";
import { fileDemand, readTranslations, translationDisabled, type DemandRow } from "./store";
import { polishTranslation } from "./text";

/** The visitor's locale, or English outside a request (scripts, tests, the worker). */
export async function resolveRequestLocale(): Promise<Locale> {
  try {
    const { getLocale } = await import("@/lib/i18n/server");
    const locale = await getLocale();
    return isSiteLocale(locale) ? locale : "en";
  } catch {
    return "en";
  }
}

/**
 * A stored translation made ready to show: target-language typography, and
 * the protected Latin/Greek spans restored to their exact source form. Null
 * when a protected span did not survive (such a row is shown in English).
 */
export function finalizeTranslation(unit: Unit, raw: string, lang: string): string | null {
  if (unit.kind === "name") return raw.replace(/\s+/g, " ").trim() || null;
  const polished = isMtLocale(lang) ? polishTranslation(unit.source, raw, lang) : raw.trim();
  return verifyProtectedSpans(
    polished,
    unit.protect.map((text) => ({ text })),
  );
}

/** A person's name in the visitor's language, from the dictionaries only (rule c). */
export function dictionaryName(locale: Locale, slug: string | undefined): string | null {
  if (!slug) return null;
  const value = getDictionary(locale)[`name.${slug}`];
  return typeof value === "string" && value.trim() ? value : null;
}

export interface LocalizeOptions {
  depth?: PlanDepth;
  /** Defaults to the request's locale. */
  locale?: Locale;
}

/**
 * Localize items for display. Returns the same array (and the same objects)
 * when there is nothing to do; otherwise shallow copies carrying a display
 * overlay (see display.ts). Logic keeps reading the English fields.
 */
export async function localizeItems<T extends PlannableItem>(
  items: readonly T[],
  opts: LocalizeOptions = {},
): Promise<T[]> {
  if (items.length === 0 || translationDisabled()) return [...items];
  const locale = opts.locale ?? (await resolveRequestLocale());
  if (!hasContentModel(locale)) return [...items];
  try {
    return await localizeFor(items, locale, opts.depth ?? "full");
  } catch (err) {
    console.warn("[translation] localize failed; serving originals:", (err as Error).message);
    return [...items];
  }
}

async function localizeFor<T extends PlannableItem>(
  items: readonly T[],
  locale: MtLocale,
  depth: PlanDepth,
): Promise<T[]> {
  const plans = items.map((item) => planItem(item, depth));
  const hashes = plans.map((plan) => plan.units.map((unit) => unitHash(locale, unit)));
  const stored = await readTranslations(locale, hashes.flat());

  const demand: DemandRow[] = [];
  const out = items.map((item, i) => {
    const plan = plans[i]!;
    const ready = new Map<number, string>();
    plan.units.forEach((unit, u) => {
      const hash = hashes[i]![u]!;
      const raw = stored.get(hash);
      const text = raw === undefined ? null : finalizeTranslation(unit, raw, locale);
      if (text !== null) ready.set(u, text);
      else if (raw === undefined) demand.push({ lang: locale, hash, unit });
    });
    const named = isPersonContentType(item.contentType) ? dictionaryName(locale, item.slug) : null;
    if (ready.size === 0 && !named) return item;
    const assembled = assembleItem(item, plan, ready);
    const overlay: DisplayOverlay = {
      locale,
      title: named ?? assembled.title,
      subtitle: assembled.subtitle,
      payload: assembled.payload,
      machineTranslated: ready.size > 0,
      pendingUnits: assembled.missing,
    };
    return attachDisplay({ ...item }, overlay);
  });
  fileDemand(demand);
  return out;
}

/** Single-item convenience for detail pages. */
export async function localizeItem<T extends PlannableItem>(
  item: T | null,
  opts: LocalizeOptions = {},
): Promise<T | null> {
  if (!item) return item;
  const [out] = await localizeItems([item], opts);
  return out ?? item;
}

/* ------------------------------------------------------------------ */
/*  Parishes                                                          */
/* ------------------------------------------------------------------ */

/** Intl's code for a site locale (Filipino is "fil" there). */
function intlLocale(locale: Locale): string {
  return locale === "tl" ? "fil" : locale;
}

let englishRegionCodes: Map<string, string> | null = null;

/** "United States" → "US": every region Intl names in English, by that name. */
export function regionCodeForEnglishName(name: string | null | undefined): string | null {
  const key = String(name ?? "")
    .trim()
    .toLowerCase();
  if (!key) return null;
  if (!englishRegionCodes) {
    englishRegionCodes = new Map();
    try {
      const names = new Intl.DisplayNames(["en"], { type: "region" });
      const A = "A".charCodeAt(0);
      for (let i = 0; i < 26; i++) {
        for (let j = 0; j < 26; j++) {
          const code = String.fromCharCode(A + i, A + j);
          let label: string | undefined;
          try {
            label = names.of(code);
          } catch {
            label = undefined;
          }
          if (label && label !== code && label !== "Unknown Region") {
            englishRegionCodes.set(label.toLowerCase(), code);
          }
        }
      }
    } catch {
      /* no Intl.DisplayNames: names stay as published */
    }
  }
  return englishRegionCodes.get(key) ?? null;
}

/**
 * A country's name in the reader's language ("United States" → "Estados
 * Unidos"), from the platform's CLDR data — no model involved. Names Intl does
 * not know, and Latin and English readers, get the name as published.
 */
export function localCountryName(
  country: string | null | undefined,
  locale: Locale,
  countryCode?: string | null,
): string | null {
  if (country == null) return null;
  if (locale === "en" || locale === "la") return country;
  const code = (countryCode ?? "").toUpperCase() || regionCodeForEnglishName(country);
  if (!code || !/^[A-Z]{2}$/.test(code)) return country;
  try {
    const english = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
    // Only replace a name that IS the English name of that code.
    if (english?.toLowerCase() !== country.trim().toLowerCase()) return country;
    return new Intl.DisplayNames([intlLocale(locale)], { type: "region" }).of(code) ?? country;
  } catch {
    return country;
  }
}

type ParishLike = {
  title: string;
  country?: string | null;
  countryCode?: string | null;
  payload?: unknown;
};

function countryOf(item: ParishLike): string | null {
  if (typeof item.countryCode === "string" && item.countryCode) return item.countryCode;
  const payload = item.payload as Record<string, unknown> | undefined;
  if (typeof payload?.countryCode === "string" && payload.countryCode) return payload.countryCode;
  const country =
    typeof item.country === "string"
      ? item.country
      : typeof payload?.country === "string"
        ? payload.country
        : null;
  return regionCodeForEnglishName(country);
}

/**
 * Parishes for the visitor reading `locale`. The name follows rule (b):
 * same-script names are untouched; a name in another script becomes
 * "Translation (Original)" once the translator has done it, meanwhile
 * "Transliteration (Original)" when the script can be transliterated, or the
 * original. The translation target is the visitor's language, or English for
 * English and Latin readers and for a language the engine cannot write
 * (Korean). A top-level `country` is shown in the reader's language. Returns
 * copies; the input items are never changed.
 */
export async function localizeParishes<T extends ParishLike>(
  items: readonly T[],
  opts: { locale?: Locale } = {},
): Promise<T[]> {
  if (items.length === 0) return [...items];
  const locale = opts.locale ?? (await resolveRequestLocale());
  try {
    const target = nameTargetFor(locale);
    const pending: Array<{ index: number; unit: Unit; hash: string }> = [];
    const out = items.map((item, index) => {
      let copy: T = item;
      const code = countryOf(item);
      if (typeof item.country === "string") {
        const country = localCountryName(item.country, locale, code);
        if (country !== item.country) copy = { ...copy, country };
      }
      const title = item.title ?? "";
      const decision = decideParishName(title, locale, { countryCode: code });
      if (decision.action === "keep") return copy;
      // An English name for a reader whose language the engine cannot write
      // (Korean): there is nothing to translate it into.
      if (decision.from === "en" && target === "en") return copy;
      if (!translationDisabled()) {
        const unit: Unit = { kind: "name", source: title, sourceLang: decision.from, protect: [] };
        pending.push({ index, unit, hash: unitHash(target, unit) });
      }
      const romanized =
        decision.fallback === "romanize" ? romanize(title, { countryCode: code }) : null;
      return romanized ? { ...copy, title: withOriginal(romanized, title) } : copy;
    });
    if (pending.length === 0) return out;

    const stored = await readTranslations(
      target,
      pending.map((p) => p.hash),
    );
    const demand: DemandRow[] = [];
    for (const p of pending) {
      const raw = stored.get(p.hash);
      const text = raw === undefined ? null : finalizeTranslation(p.unit, raw, target);
      if (text)
        out[p.index] = { ...out[p.index]!, title: withOriginal(text, items[p.index]!.title) };
      else if (raw === undefined) demand.push({ lang: target, hash: p.hash, unit: p.unit });
    }
    fileDemand(demand);
    return out;
  } catch (err) {
    console.warn("[translation] parishes failed; serving originals:", (err as Error).message);
    return [...items];
  }
}
