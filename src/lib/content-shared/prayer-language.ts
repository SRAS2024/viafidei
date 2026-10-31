/**
 * Prayer language support (spec — "Prayer Language Support").
 *
 * A prayer's payload may carry the prayer text in more than one language:
 * the vernacular `body`, plus optional `latin` / `greek` fields and/or a
 * generic `translations` collection. `buildPrayerVariants` flattens those
 * into an ordered, de-duplicated list the toggle can render.
 *
 * Latin and Greek are liturgical languages we must reproduce verbatim, so
 * their variants carry `preserve: true` — the renderer marks them
 * `translate="no"` so device/auto translation leaves them untouched even
 * when the rest of the page is translated.
 *
 * A language the payload's `machineTranslated` marker names is one of the
 * June 2026 machine fills, not received liturgical text. It is still offered
 * (the owner wants the toggle on every prayer that has another language), but
 * flagged `unofficial` so every surface says so under the text. The flag goes
 * the moment the backfill replaces the fill with authentic text and drops the
 * language from the marker. The pages build their variants through
 * `publishedPrayerVariants` (data/prayer-sets), which also withdraws it where
 * the stored text already IS the curated received text under a marker that
 * outlived the fill.
 */
export interface PrayerVariant {
  /** Normalised language code, e.g. "en", "la", "el". */
  code: string;
  /** Human label, e.g. "English", "Latin", "Greek". */
  label: string;
  /** The prayer text in this language. */
  text: string;
  /** True for languages that must never be auto-translated (Latin / Greek). */
  preserve: boolean;
  /** True for a machine translation (`machineTranslated`), not received text. */
  unofficial?: boolean;
  /**
   * The language `text` is actually written in, when it is not `code`: the
   * vernacular slot ("en") holding the reader's machine translation
   * (src/lib/translation). Renderers use it for the `lang` attribute.
   */
  lang?: string;
}

/** A published prayer as the language-aware prayer lists and inline panels need it. */
export interface PrayerWithVariants {
  slug: string;
  title: string;
  /** Ordered variants (vernacular first, then Latin / Greek / …). */
  variants: PrayerVariant[];
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  la: "Latin",
  el: "Greek",
  es: "Spanish",
  it: "Italian",
  fr: "French",
  pt: "Portuguese",
  de: "German",
  pl: "Polish",
};

/** Codes whose text must be preserved verbatim (never auto-translated). */
const PRESERVE_CODES = new Set(["la", "el"]);

/** Folds the many spellings of Latin / Greek down to one canonical code. */
function normalizeCode(raw: string): string {
  const c = raw.trim().toLowerCase();
  if (c === "latin" || c === "lat" || c === "la") return "la";
  if (c === "greek" || c === "grc" || c === "el" || c === "gr") return "el";
  // Some payloads use locale forms like "en-US" — keep just the language.
  return c.split(/[-_]/)[0] || c;
}

function labelFor(code: string): string {
  return LANGUAGE_LABELS[code] ?? code.toUpperCase();
}

/**
 * How a prayer reads in the language the reader chose. The vernacular is the
 * first variant that is not a preserved liturgical language (English, Spanish,
 * …), or the only variant there is; every other variant is an alternate the
 * reader can select. `chosen` falls back to the vernacular when this prayer does
 * not carry it, so choosing Greek never blanks a prayer that has no Greek.
 */
export function resolvePrayerLanguage(
  variants: readonly PrayerVariant[],
  chosen: string | null,
): { vernacular?: PrayerVariant; alternates: PrayerVariant[]; shown?: PrayerVariant } {
  const vernacular = variants.find((v) => !v.preserve) ?? variants[0];
  const alternates = variants.filter((v) => v.code !== vernacular?.code);
  const shown = (chosen ? alternates.find((v) => v.code === chosen) : undefined) ?? vernacular;
  return { vernacular, alternates, shown };
}

/**
 * Reads every available language variant out of a published prayer payload,
 * vernacular first, then dedicated Latin/Greek fields, then any generic
 * `translations`. Empty / whitespace-only text is ignored, each language
 * appears at most once, and a machine-translated one is marked `unofficial`.
 */
export function buildPrayerVariants(payload: Record<string, unknown>): PrayerVariant[] {
  const out: PrayerVariant[] = [];
  const seen = new Set<string>();
  const machine = new Set(
    Array.isArray(payload.machineTranslated)
      ? payload.machineTranslated
          .filter((lang): lang is string => typeof lang === "string")
          .map(normalizeCode)
      : [],
  );

  const push = (rawCode: string, text: unknown) => {
    if (typeof text !== "string" || !text.trim()) return;
    const code = normalizeCode(rawCode);
    if (!code || seen.has(code)) return;
    seen.add(code);
    out.push({
      code,
      label: labelFor(code),
      text,
      preserve: PRESERVE_CODES.has(code),
      ...(machine.has(code) ? { unofficial: true } : {}),
    });
  };

  // Vernacular / primary text first. Knowledge-base prayers use `body`; the
  // worker's PrayerExtractor emits `prayerText` — accept either so worker-built
  // prayers render their text, not just their title.
  const primaryLang = typeof payload.language === "string" ? payload.language : "en";
  push(primaryLang, payload.body ?? payload.prayerText);

  // Dedicated liturgical-language fields.
  push("la", payload.latin);
  push("el", payload.greek);

  // Generic translations: array of {language,text} or a {code: text} record.
  const translations = payload.translations;
  if (Array.isArray(translations)) {
    for (const entry of translations) {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const e = entry as Record<string, unknown>;
        const lang = e.language ?? e.lang ?? e.code;
        if (typeof lang === "string") push(lang, e.text ?? e.body);
      }
    }
  } else if (translations && typeof translations === "object") {
    for (const [lang, text] of Object.entries(translations as Record<string, unknown>)) {
      push(lang, text);
    }
  }

  return out;
}
