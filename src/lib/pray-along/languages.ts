/**
 * The languages the pray-along audio speaks: the site's twelve, plus Greek, which a
 * prayer can carry beside its vernacular and Latin (the Latin / Greek chips).
 *
 * Pure: no I/O, no React. The voice engine (voice-engine/) reads the same codes from
 * voices.json, so a code here and a code there always name the same language.
 */

export const AUDIO_LANGS = [
  "en",
  "es",
  "fr",
  "it",
  "de",
  "pt",
  "pl",
  "la",
  "tl",
  "vi",
  "ko",
  "zh",
  "el",
] as const;

export type AudioLang = (typeof AUDIO_LANGS)[number];

export function isAudioLang(value: unknown): value is AudioLang {
  return typeof value === "string" && (AUDIO_LANGS as readonly string[]).includes(value);
}

/**
 * A language code as the site writes it ("es", "en-US", "grc", "Latin", "fil") as the
 * audio's own code, or null when the audio does not speak it.
 */
export function toAudioLang(code: string | null | undefined): AudioLang | null {
  if (!code) return null;
  const c = code.trim().toLowerCase();
  if (c === "latin" || c === "lat") return "la";
  if (c === "greek" || c === "grc" || c === "gr") return "el";
  if (c === "fil" || c === "filipino" || c === "tagalog" || c === "tgl") return "tl";
  const base = c.split(/[-_]/)[0] ?? c;
  if (base === "fil") return "tl";
  return isAudioLang(base) ? base : null;
}

/** English names, for logs and the engine's reports. */
export const AUDIO_LANG_NAMES: Readonly<Record<AudioLang, string>> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  it: "Italian",
  de: "German",
  pt: "Portuguese",
  pl: "Polish",
  la: "Latin",
  tl: "Filipino",
  vi: "Vietnamese",
  ko: "Korean",
  zh: "Chinese",
  el: "Greek",
};
