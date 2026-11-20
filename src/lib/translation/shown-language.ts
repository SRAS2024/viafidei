/**
 * The language of the content a page shows.
 *
 * Content is published in English and shown as published until it is translated: always
 * on the Latin site (nothing is machine-translated into Latin), and on the others while a
 * translation is pending. Inside a page whose `lang` is the reader's language, a screen
 * reader reads that English in the page's voice: VoiceOver read the Latin site's English
 * biographies with a Latin voice, and a Korean page's English titles with a Korean one. So
 * untranslated text is marked `lang="en"`. The translation overlay (display.ts) gives the
 * shown text; where it is still exactly the stored text, it is English.
 *
 * Pure: no I/O, no React.
 */

import { looksLatin } from "./rules";

/** Two shown values are the same text: strings by value, structures by content. */
export function sameText(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "string" || typeof b === "string") return false;
  if (a == null || b == null) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** The page is in another language than the English content is written in. */
export function pageIsNotEnglish(locale: string | null | undefined): boolean {
  return !!locale && locale !== "en";
}

/**
 * The language of text the reader sees exactly as it is stored, on a page in another
 * language: `"en"`, or `"la"` for a Latin title or text ("Anima Christi", "Salve
 * Regina", "Rerum Novarum"), which must not be read in an English voice. On the Latin
 * site Latin needs no mark. Otherwise undefined (the page's own language applies).
 */
export function englishWhereUntranslated(
  locale: string | null | undefined,
  shown: unknown,
  stored: unknown,
): "en" | "la" | undefined {
  if (!pageIsNotEnglish(locale) || !sameText(shown, stored)) return undefined;
  if (typeof shown === "string" && looksLatin(shown)) return locale === "la" ? undefined : "la";
  return "en";
}
