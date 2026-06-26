/**
 * Machine-translation provider seam for the liturgical translation engine.
 *
 * The deterministic corpus (`prayer-translator`) is and remains the PRIMARY,
 * auto-publishable path: it only ever emits authentic *received* liturgical
 * text (the Vulgate / Missale Romanum / received Greek), never a guess. This
 * module is the explicitly-authorized FALLBACK for prayers / litanies / guides
 * the corpus cannot resolve — a pluggable Google Translate / AI provider, gated
 * on an environment variable the operator sets. With no key configured the
 * fallback is simply disabled and every call returns `null`.
 *
 * Accuracy mandate ("it is vital that it doesn't mistranslate"): the authentic
 * corpus (`prayer-translator`) is ALWAYS tried first and is the only source that
 * can be mistaken for received text. This fallback runs only for what the corpus
 * cannot resolve, and its output is always flagged `source:"machine"` so it is
 * auditable and can be corrected. Per the site owner's directive — every prayer
 * and litany should carry BOTH a Latin and a Greek text — a configured machine
 * translation is auto-published by default to fill the remaining gap; set
 * `TRANSLATION_AUTOPUBLISH_MACHINE=0` (or `false`/`off`) to instead route machine
 * drafts to human review before they go live.
 *
 * Two providers, tried in order of configuration:
 *   1. A generic AI chat endpoint (`TRANSLATION_AI_API_URL`, OpenAI-compatible,
 *      falling back to the `EXTRACTION_AI_*` provider so one AI key powers both)
 *      — preferred, because it can be prompted for *ecclesiastical* Latin and
 *      *liturgical / Koine* Greek rather than the modern register a generic MT
 *      engine targets.
 *   2. Google Cloud Translation v2 (`GOOGLE_TRANSLATE_API_KEY`).
 */

import type { TargetLang } from "./prayer-translator";

export interface MachineTranslation {
  text: string;
  /** Always "machine" — the marker the review/publish gate keys off. */
  source: "machine";
  /** Which provider produced it, for the review note + audit trail. */
  provider: string;
  /** Machine output is never authentic received text. */
  accurate: false;
}

const LANG_NAME: Record<TargetLang, string> = {
  la: "Ecclesiastical (Church) Latin",
  el: "liturgical Greek",
};

/** Google Translate language codes for our two targets. */
const GOOGLE_CODE: Record<TargetLang, string> = { la: "la", el: "el" };

const TIMEOUT_MS = 12_000;

/** Is any machine-translation provider configured? */
export function machineTranslationEnabled(): boolean {
  return Boolean(aiConfig() || googleKey());
}

/**
 * Whether the worker may publish a machine (AI / Google) translation directly to
 * fill a Latin/Greek gap the authentic corpus can't resolve.
 *
 * Per the site owner's directive — every prayer and litany should end up with
 * both a Latin and a Greek text — this defaults to ON (opt-out). The authentic
 * corpus is always tried first; only the genuine remainder is machine-filled,
 * recorded with `source:"machine"` provenance so it stays auditable. Set
 * `TRANSLATION_AUTOPUBLISH_MACHINE=0` (or `false`/`off`/`no`) to instead route
 * machine drafts to human review before they go live.
 */
export function autoPublishMachineTranslations(): boolean {
  const v = (process.env.TRANSLATION_AUTOPUBLISH_MACHINE ?? "").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

function aiConfig(): { url: string; key: string; model: string } | null {
  // Prefer the dedicated translation config (it can be steered to the
  // liturgical register), but fall back to the EXTRACTION_AI_* provider so a
  // single AI key configured under either name powers translation too — the
  // mirror of extraction-provider, which already falls back to TRANSLATION_AI_*.
  const url = (
    process.env.TRANSLATION_AI_API_URL ??
    process.env.EXTRACTION_AI_API_URL ??
    ""
  ).trim();
  const key = (
    process.env.TRANSLATION_AI_API_KEY ??
    process.env.EXTRACTION_AI_API_KEY ??
    ""
  ).trim();
  if (!url || !key) return null;
  const model = (
    process.env.TRANSLATION_AI_MODEL ??
    process.env.EXTRACTION_AI_MODEL ??
    "gpt-4o-mini"
  ).trim();
  return { url, key, model: model || "gpt-4o-mini" };
}

function googleKey(): string | null {
  const k = (process.env.GOOGLE_TRANSLATE_API_KEY ?? "").trim();
  return k || null;
}

function abortableTimeout(): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

/**
 * Produce a *proposed* machine translation of an English prayer into Latin or
 * Greek. Returns `null` when no provider is configured or the call fails — the
 * caller then falls back to filing a plain review task. The result is always
 * flagged `accurate:false` so it can never be mistaken for received text.
 */
export async function proposeMachineTranslation(
  english: string,
  target: TargetLang,
): Promise<MachineTranslation | null> {
  if (typeof english !== "string" || !english.trim()) return null;

  // Prefer the AI endpoint (it can be steered to the liturgical register).
  const ai = aiConfig();
  if (ai) {
    const text = await viaAi(english, target, ai).catch(() => null);
    if (text) return { text, source: "machine", provider: "ai", accurate: false };
  }

  const gkey = googleKey();
  if (gkey) {
    const text = await viaGoogle(english, target, gkey).catch(() => null);
    if (text) return { text, source: "machine", provider: "google-translate", accurate: false };
  }

  return null;
}

async function viaAi(
  english: string,
  target: TargetLang,
  cfg: { url: string; key: string; model: string },
): Promise<string | null> {
  const { signal, clear } = abortableTimeout();
  try {
    const system =
      `You are a careful liturgical translator for the Roman Catholic Church. ` +
      `Translate the user's prayer text into ${LANG_NAME[target]}, using the ` +
      `traditional received liturgical wording wherever a canonical form exists. ` +
      `Preserve line breaks. Do NOT add commentary, transliteration, or notes — ` +
      `output ONLY the translated prayer text.`;
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.key}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: english },
        ],
      }),
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content.trim() : null;
  } finally {
    clear();
  }
}

async function viaGoogle(english: string, target: TargetLang, key: string): Promise<string | null> {
  const { signal, clear } = abortableTimeout();
  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: english,
          source: "en",
          target: GOOGLE_CODE[target],
          format: "text",
        }),
        signal,
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: { translations?: Array<{ translatedText?: unknown }> };
    };
    const text = data.data?.translations?.[0]?.translatedText;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } finally {
    clear();
  }
}
