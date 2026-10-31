/**
 * The languages the translation engine writes content into.
 *
 * Why these ten: the scaffold commit (12cc0ea, 2026-04-23) shipped interface
 * dictionaries for twelve locales — en, es, fr, it, de, pt, pl, la, tl, vi, ko,
 * zh — and that set has never changed since. Every published item is written in
 * English, so English is the source and not a target; Latin is a liturgical
 * language the rules forbid machine translation into or out of (see rules.ts),
 * so a visitor who picks Latin keeps the interface in Latin and the content as
 * published. That leaves exactly ten target languages.
 *
 * Nine of the ten have a translation model (engine/models.ts). Korean has
 * none that works — the only English→Korean OPUS-MT conversion is broken — so
 * a Korean reader keeps the interface in Korean and the content as published.
 *
 * The site never had a content translation engine before this one. The
 * scaffold planned one (per-type PrayerTranslation, SaintTranslation, …
 * tables with a MACHINE/HUMAN_REVIEWED status, dropped unused in
 * 0025_drop_legacy_system), and its only Google Translate code was the Admin
 * Worker's keyless translate.googleapis.com fallback for Latin/Greek prayer
 * drafts (translation-provider.ts, f04b980), removed in 01b5931 when the
 * worker dropped every external AI/MT dependency.
 */

import { isSupportedLocale, type Locale } from "@/lib/i18n/locales";

import { candidatesFor } from "./engine/models";

/** Content is authored in English. */
export const SOURCE_LOCALE = "en" as const satisfies Locale;

/** The ten machine-translation targets, in the order the dictionaries list them. */
export const MT_TARGET_LOCALES = [
  "es",
  "fr",
  "it",
  "de",
  "pt",
  "pl",
  "tl",
  "vi",
  "ko",
  "zh",
] as const satisfies readonly Locale[];

export type MtLocale = (typeof MT_TARGET_LOCALES)[number];

export function isMtLocale(value: unknown): value is MtLocale {
  return typeof value === "string" && (MT_TARGET_LOCALES as readonly string[]).includes(value);
}

/** Every locale the site serves (MT targets plus English and Latin). */
export function isSiteLocale(value: unknown): value is Locale {
  return typeof value === "string" && isSupportedLocale(value);
}

/** English names, for logs and the operator note. */
export const MT_LOCALE_NAMES: Record<MtLocale, string> = {
  es: "Spanish",
  fr: "French",
  it: "Italian",
  de: "German",
  pt: "Portuguese (Brazil)",
  pl: "Polish",
  tl: "Filipino (Tagalog)",
  vi: "Vietnamese",
  ko: "Korean",
  zh: "Chinese (Simplified)",
};

/**
 * Does the engine have a model that translates content into `locale`? All of
 * the ten do except Korean (see engine/models.ts for why): a Korean reader is
 * served the content as published.
 */
export function hasContentModel(locale: unknown): locale is MtLocale {
  return isMtLocale(locale) && candidatesFor(`en>${locale}`).length > 0;
}
