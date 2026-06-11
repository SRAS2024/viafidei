/**
 * AI-assisted content extraction for the Admin Worker — the capability that
 * removes the ceiling on what the worker can publish.
 *
 * The deterministic extractors handle canonical, well-structured pages, but the
 * open web is messy: most fetched pages don't yield a complete, schema-valid
 * record by regex alone, so the artifact stalls with "missing fields" and never
 * publishes. This is the explicitly-authorized AI fallback — when the
 * deterministic extractor leaves required fields missing, an AI provider reads
 * the page text and fills ONLY the missing fields, strictly from what the text
 * actually says (it is instructed never to invent, guess, or use outside
 * knowledge).
 *
 * Accuracy is NOT lowered: the AI-filled artifact still passes the strict content
 * schema, cross-source verification, strict QA, and the full ten-dimension
 * quality score before it can publish — exactly like any other artifact. AI
 * widens what the worker can *extract*; the gates still decide what publishes.
 *
 * Gated on an env key; a no-op when unset (and in skip-network / test mode). It
 * reuses the translation AI config when a dedicated extraction key isn't set, so
 * one OpenAI-compatible endpoint can power extraction and translation alike.
 */

import { getContentSchema } from "@/lib/checklist";
import type { ExtractorOutput } from "./extractors";
import { makeProvenance } from "./provenance";

const TIMEOUT_MS = 20_000;
const MAX_TEXT_CHARS = 24_000; // keep the prompt bounded

function aiConfig(): { url: string; key: string; model: string } | null {
  const url = (
    process.env.EXTRACTION_AI_API_URL ??
    process.env.TRANSLATION_AI_API_URL ??
    ""
  ).trim();
  const key = (
    process.env.EXTRACTION_AI_API_KEY ??
    process.env.TRANSLATION_AI_API_KEY ??
    ""
  ).trim();
  if (!url || !key) return null;
  const model = (
    process.env.EXTRACTION_AI_MODEL ??
    process.env.TRANSLATION_AI_MODEL ??
    "gpt-4o-mini"
  ).trim();
  return { url, key, model: model || "gpt-4o-mini" };
}

/** Is AI-assisted extraction configured and permitted right now? */
export function extractionAiEnabled(): boolean {
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return false;
  return aiConfig() != null;
}

/** Pull the first balanced JSON object out of an AI response (handles code fences). */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < raw.length; i += 1) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const obj = JSON.parse(raw.slice(start, i + 1));
          return obj && typeof obj === "object" && !Array.isArray(obj)
            ? (obj as Record<string, unknown>)
            : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function abortable(): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

/**
 * Ask the AI to extract the named fields from the page text. Returns a record
 * with only the requested fields it could find (omitting anything not clearly
 * supported by the text), or null when no provider is configured / the call
 * fails. Never throws.
 */
export async function aiExtractFields(opts: {
  contentType: string;
  fields: string[];
  text: string;
  title?: string | null;
}): Promise<Record<string, unknown> | null> {
  const cfg = aiConfig();
  if (!cfg || opts.fields.length === 0 || !opts.text.trim()) return null;
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return null;

  const schema = getContentSchema(opts.contentType as never);
  const what = schema?.instruction?.description ?? `a Catholic ${opts.contentType} record`;
  const text = opts.text.slice(0, MAX_TEXT_CHARS);
  const system =
    "You are a precise extraction engine for a Roman Catholic reference website. " +
    "From the SOURCE TEXT you are given, extract ONLY the requested fields. Use ONLY " +
    "information explicitly stated in the source text — never invent, guess, infer, or " +
    "use outside knowledge. If a field is not clearly supported by the text, omit it. " +
    "Respond with STRICT JSON only: a single object whose keys are the requested field " +
    "names and whose values are the extracted content (strings, numbers, or arrays of " +
    "strings as appropriate). No commentary, no markdown.";
  const user =
    `This source describes ${what}.\n` +
    `Extract these fields if (and only if) the text supports them: ${opts.fields.join(", ")}.\n` +
    (opts.title ? `Title hint: ${opts.title}\n` : "") +
    `\nSOURCE TEXT:\n${text}`;

  const { signal, clear } = abortable();
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    const parsed = parseJsonObject(content);
    if (!parsed) return null;
    // Keep only the requested fields with usable values.
    const out: Record<string, unknown> = {};
    for (const f of opts.fields) {
      const v = parsed[f];
      if (v == null) continue;
      if (typeof v === "string" && v.trim()) out[f] = v.trim();
      else if (typeof v === "number" && Number.isFinite(v)) out[f] = v;
      else if (Array.isArray(v) && v.length > 0) out[f] = v;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  } finally {
    clear();
  }
}

/**
 * Ask the AI which of the given (field, value) pairs are EXPLICITLY supported by
 * the source text. Returns the subset of field names it confirms — conservative
 * by construction: anything it is not certain about is omitted. Never throws;
 * returns [] when no provider is configured or in skip-network / test mode.
 *
 * This powers the cross-source verification assist. The hand-curated
 * ground-truth content publishes on the strength of a single top Catholic
 * authority; live-extracted content normally needs an INDEPENDENT source to
 * confirm each sensitive fact. When those independent sources are merely
 * unreachable (a Vatican page 404s, a login wall) — not disagreeing — an AI
 * confirmation that the artifact's OWN top-authority source text actually states
 * each value lets it verify on that same single-authoritative-source basis,
 * without ever papering over a real disagreement (the caller gates on "no
 * MISMATCH occurred").
 */
export async function aiConfirmFields(opts: {
  contentType: string;
  text: string;
  pairs: Array<{ field: string; value: string }>;
}): Promise<string[]> {
  const cfg = aiConfig();
  if (!cfg || opts.pairs.length === 0 || !opts.text.trim()) return [];
  if (process.env.ADMIN_WORKER_SKIP_NETWORK === "1") return [];

  const text = opts.text.slice(0, MAX_TEXT_CHARS);
  const list = opts.pairs.map((p, i) => `${i + 1}. ${p.field} = ${p.value}`).join("\n");
  const system =
    "You are a precise fact-checker for a Roman Catholic reference website. You are " +
    "given SOURCE TEXT and a list of field/value claims. For EACH claim, decide whether " +
    "the value is EXPLICITLY stated or unambiguously supported by the source text. Use " +
    "ONLY the source text — never outside knowledge, never a guess. Respond with STRICT " +
    'JSON only: an object {"confirmed": ["fieldName", ...]} listing the field names whose ' +
    "value the source text explicitly supports. Omit any field you are not certain about. " +
    "No commentary, no markdown.";
  const user = `CLAIMS:\n${list}\n\nSOURCE TEXT:\n${text}`;

  const { signal, clear } = abortable();
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return [];
    const parsed = parseJsonObject(content);
    const confirmed = parsed?.confirmed;
    if (!Array.isArray(confirmed)) return [];
    const requested = new Set(opts.pairs.map((p) => p.field));
    const out: string[] = [];
    for (const c of confirmed) {
      if (typeof c === "string" && requested.has(c) && !out.includes(c)) out.push(c);
    }
    return out;
  } catch {
    return [];
  } finally {
    clear();
  }
}

/**
 * Enrich a deterministic extractor result with AI-filled fields for whatever it
 * left missing. Returns the SAME output unchanged when AI is disabled or finds
 * nothing — so the default deployment behaves exactly as before. AI-filled
 * fields carry AI_EXTRACTION provenance so the audit trail shows their origin,
 * and they still face every downstream gate before publishing.
 */
export async function enrichExtractorWithAI<T extends Record<string, unknown>>(
  output: ExtractorOutput<T>,
  ctx: {
    contentType: string;
    text: string;
    title?: string | null;
    url: string;
    host: string;
    checksum?: string | null;
  },
): Promise<{ output: ExtractorOutput<T>; aiFilled: string[] }> {
  if (!extractionAiEnabled() || output.missingFields.length === 0) {
    return { output, aiFilled: [] };
  }
  const filled = await aiExtractFields({
    contentType: ctx.contentType,
    fields: output.missingFields,
    text: ctx.text,
    title: ctx.title,
  }).catch(() => null);
  if (!filled) return { output, aiFilled: [] };

  const fields = { ...output.fields } as Record<string, unknown>;
  const provenance = [...output.sourceEvidence];
  const aiFilled: string[] = [];
  for (const [name, value] of Object.entries(filled)) {
    fields[name] = value;
    aiFilled.push(name);
    provenance.push(
      makeProvenance({
        fieldName: name,
        sourceUrl: ctx.url,
        sourceHost: ctx.host,
        snippet:
          typeof value === "string" ? value.slice(0, 160) : JSON.stringify(value).slice(0, 160),
        method: "AI_EXTRACTION",
        confidence: 0.6,
        checksum: ctx.checksum ?? undefined,
      }),
    );
  }
  const stillMissing = output.missingFields.filter((f) => !aiFilled.includes(f));
  return {
    output: {
      ...output,
      fields: fields as Partial<T>,
      missingFields: stillMissing,
      sourceEvidence: provenance,
      warnings: [...output.warnings, `ai-filled: ${aiFilled.join(", ")}`],
    },
    aiFilled,
  };
}
