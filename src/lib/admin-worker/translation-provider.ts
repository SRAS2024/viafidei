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
 * auditable and can be corrected. It translates the EXACT stored prayer text
 * (word-for-word), never a paraphrase. Per the site owner's directive — every
 * prayer and litany should carry BOTH a Latin and a Greek text — a machine
 * translation is auto-published by default to fill the remaining gap; set
 * `TRANSLATION_AUTOPUBLISH_MACHINE=0` (or `false`/`off`) to instead route machine
 * drafts to human review before they go live.
 *
 * Three providers, tried in order of quality:
 *   1. A generic AI chat endpoint (`TRANSLATION_AI_API_URL`, OpenAI-compatible,
 *      falling back to the `EXTRACTION_AI_*` provider so one AI key powers both)
 *      — preferred, because it can be prompted for *ecclesiastical* Latin and
 *      *liturgical / Koine* Greek rather than the modern register a generic MT
 *      engine targets.
 *   2. Google Cloud Translation v2 (`GOOGLE_TRANSLATE_API_KEY`).
 *   3. KEYLESS Google translate endpoint — the same free endpoint the public
 *      Translate website uses, needing no API key. This makes Latin/Greek
 *      coverage work out of the box with zero configuration (the keyless
 *      default the site owner asked for). It is fail-open and on by default;
 *      set `ADMIN_WORKER_KEYLESS_TRANSLATE=0` (or `false`/`off`/`no`) to opt out,
 *      or `ADMIN_WORKER_SKIP_NETWORK=1` (tests/offline) to force it off.
 *
 * Register caveat: the keyless endpoint targets *modern* Latin/Greek, not the
 * received liturgical register an AI key can be steered to — hence the AI/keyed
 * providers run first and the keyless output stays flagged `accurate:false`.
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

// A mainstream browser UA for the keyless endpoint (it varies output for unknown
// clients). Matches the worker's other fetchers.
const KEYLESS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Is any machine-translation provider available (keyed OR the keyless endpoint)? */
export function machineTranslationEnabled(): boolean {
  return Boolean(aiConfig() || googleKey() || keylessTranslationEnabled());
}

/**
 * Whether the keyless Google translate endpoint may run. Default ON — it needs
 * no API key, so Latin/Greek coverage works with zero configuration. Disabled
 * by an explicit opt-out or offline/test mode.
 */
export function keylessTranslationEnabled(): boolean {
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return false;
  const v = (process.env.ADMIN_WORKER_KEYLESS_TRANSLATE ?? "").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
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

  // Keyless fallback — no API key required. Translates the exact stored text.
  if (keylessTranslationEnabled()) {
    const text = await viaKeylessGoogle(english, target).catch(() => null);
    if (text) {
      return { text, source: "machine", provider: "google-translate-free", accurate: false };
    }
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

/**
 * Parse the free (`client=gtx`) Google translate response. Its shape is a
 * nested array `[[ [translatedChunk, sourceChunk, ...], ... ], ...]`; the
 * translation is every `segment[0]` of `data[0]` joined together. Exported so
 * the parser can be unit-tested without a network call.
 */
export function parseKeylessGoogleResponse(jsonText: string): string | null {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  const parts: string[] = [];
  for (const seg of data[0] as unknown[]) {
    if (Array.isArray(seg) && typeof seg[0] === "string") parts.push(seg[0]);
  }
  const text = parts.join("").trim();
  return text || null;
}

/**
 * Split text into request-sized chunks on line boundaries (the free endpoint is
 * a GET, so the query string is length-limited). Keeps whole lines together so
 * a prayer's structure survives the round-trip.
 */
function chunkForTranslate(text: string, maxChars = 1500): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function viaKeylessGoogle(english: string, target: TargetLang): Promise<string | null> {
  const chunks = chunkForTranslate(english);
  const out: string[] = [];
  for (const chunk of chunks) {
    const { signal, clear } = abortableTimeout();
    try {
      const url =
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en` +
        `&tl=${GOOGLE_CODE[target]}&dt=t&q=${encodeURIComponent(chunk)}`;
      const res = await fetch(url, {
        signal,
        headers: { "User-Agent": KEYLESS_USER_AGENT },
      });
      if (!res.ok) return null;
      const parsed = parseKeylessGoogleResponse(await res.text());
      if (!parsed) return null;
      out.push(parsed);
    } finally {
      clear();
    }
  }
  const joined = out.join("\n").trim();
  return joined || null;
}
