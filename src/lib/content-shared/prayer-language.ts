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
 * Reads every available language variant out of a published prayer payload,
 * vernacular first, then dedicated Latin/Greek fields, then any generic
 * `translations`. Empty / whitespace-only text is ignored, and each
 * language appears at most once.
 */
export function buildPrayerVariants(payload: Record<string, unknown>): PrayerVariant[] {
  const out: PrayerVariant[] = [];
  const seen = new Set<string>();

  const push = (rawCode: string, text: unknown) => {
    if (typeof text !== "string" || !text.trim()) return;
    const code = normalizeCode(rawCode);
    if (!code || seen.has(code)) return;
    seen.add(code);
    out.push({ code, label: labelFor(code), text, preserve: PRESERVE_CODES.has(code) });
  };

  // Vernacular / primary text first.
  const primaryLang = typeof payload.language === "string" ? payload.language : "en";
  push(primaryLang, payload.body);

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
