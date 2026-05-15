import type { IngestedItem } from "./types";

/**
 * Per-content-type formatter that normalises the shape of an ingested
 * item before it reaches the validator. This is the "correct
 * formatting for that specific content type" stage of the ingestion
 * quality gate — the validator and the persistence layer rely on the
 * resulting normalised text, so all of them see the same canonical
 * representation regardless of which adapter produced the item.
 *
 * Normalisations applied to every kind:
 *   - Strip leading / trailing whitespace from text fields.
 *   - Collapse runs of internal whitespace into single spaces (except
 *     for body text where line structure matters; there we only collapse
 *     trailing whitespace per line and trim blank lines from the edges).
 *   - Normalise smart quotes / dashes to ASCII equivalents so search and
 *     dedup checksums are stable across sources.
 *   - Strip HTML entities the parsers may have left behind (`&amp;`,
 *     `&nbsp;`, `&#39;`, …).
 *
 * Per-kind normalisations layer on top:
 *   - `prayer.body`     — preserve line breaks; trim internal blank lines
 *                          to a maximum of one in a row.
 *   - `saint.biography` — same as prayer body.
 *   - `apparition.summary` — collapse to single-paragraph prose (single
 *                            space between sentences).
 *   - `parish.name`     — title-case where the whole name was screaming-
 *                          uppercase; keep mixed-case verbatim.
 *   - `liturgy.body`    — preserve line breaks like prayer body.
 *   - `guide.summary`   — collapse to single paragraph.
 */

const HTML_ENTITY_MAP: Array<[RegExp, string]> = [
  [/&nbsp;/gi, " "],
  [/&amp;/gi, "&"],
  [/&lt;/gi, "<"],
  [/&gt;/gi, ">"],
  [/&quot;/gi, '"'],
  [/&#39;|&apos;/gi, "'"],
  [/&hellip;/gi, "…"],
  [/&mdash;/gi, "—"],
  [/&ndash;/gi, "–"],
  [/&rsquo;|&lsquo;/gi, "'"],
  [/&rdquo;|&ldquo;/gi, '"'],
];

const SMART_QUOTE_MAP: Array<[RegExp, string]> = [
  [/[‘’‚‛]/g, "'"],
  [/[“”„‟]/g, '"'],
  [/[–—]/g, "-"],
  [/…/g, "..."],
];

function decodeEntities(text: string): string {
  let out = text;
  for (const [re, repl] of HTML_ENTITY_MAP) out = out.replace(re, repl);
  // Numeric entities — &#1234; / &#x1A; — decoded best-effort.
  out = out.replace(/&#(\d+);/g, (_, code) => {
    const n = parseInt(code, 10);
    return Number.isFinite(n) && n >= 32 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  });
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, code) => {
    const n = parseInt(code, 16);
    return Number.isFinite(n) && n >= 32 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  });
  return out;
}

function normaliseInline(text: string): string {
  let out = decodeEntities(text);
  for (const [re, repl] of SMART_QUOTE_MAP) out = out.replace(re, repl);
  // Replace any non-newline whitespace run with a single space.
  out = out.replace(/[^\S\n]+/g, " ").trim();
  return out;
}

/**
 * Trim every line, strip trailing whitespace, and collapse three+ blank
 * lines into one. Preserves intentional paragraph breaks but discards
 * formatting noise (long runs of empty lines from copy-pasted HTML).
 */
function normaliseMultiline(text: string): string {
  let out = decodeEntities(text);
  for (const [re, repl] of SMART_QUOTE_MAP) out = out.replace(re, repl);
  // Per-line trim.
  out = out
    .split(/\r?\n/)
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n");
  // Collapse 3+ blank lines.
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

function maybeTitleCase(value: string): string {
  // Only re-case strings that are entirely uppercase / digits / spaces;
  // leave mixed-case (the normal case) untouched so legitimate proper
  // nouns are preserved.
  if (!/[A-Z]/.test(value)) return value;
  if (/[a-z]/.test(value)) return value;
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/**
 * Normalise the user-visible text fields on an IngestedItem, returning
 * a new item with the formatted fields applied. The slug and
 * externalSourceKey are NOT modified here — slug normalisation is
 * owned by `slug.ts` (called by `sanitize()`), and the external source
 * key is treated as an opaque identifier.
 */
export function formatIngestedItem(item: IngestedItem): IngestedItem {
  switch (item.kind) {
    case "prayer":
      return {
        ...item,
        defaultTitle: normaliseInline(item.defaultTitle),
        body: normaliseMultiline(item.body),
        category: normaliseInline(item.category),
      };
    case "saint":
      return {
        ...item,
        canonicalName: normaliseInline(item.canonicalName),
        biography: normaliseMultiline(item.biography),
        ...(typeof item.officialPrayer === "string"
          ? { officialPrayer: normaliseMultiline(item.officialPrayer) }
          : {}),
        ...(typeof item.feastDay === "string" ? { feastDay: normaliseInline(item.feastDay) } : {}),
      };
    case "apparition":
      return {
        ...item,
        title: normaliseInline(item.title),
        summary: normaliseInline(item.summary),
        ...(typeof item.location === "string" ? { location: normaliseInline(item.location) } : {}),
        ...(typeof item.country === "string" ? { country: normaliseInline(item.country) } : {}),
        ...(typeof item.officialPrayer === "string"
          ? { officialPrayer: normaliseMultiline(item.officialPrayer) }
          : {}),
        approvedStatus: normaliseInline(item.approvedStatus),
      };
    case "parish":
      return {
        ...item,
        name: maybeTitleCase(normaliseInline(item.name)),
        ...(typeof item.address === "string" ? { address: normaliseInline(item.address) } : {}),
        ...(typeof item.city === "string" ? { city: normaliseInline(item.city) } : {}),
        ...(typeof item.region === "string" ? { region: normaliseInline(item.region) } : {}),
        ...(typeof item.country === "string" ? { country: normaliseInline(item.country) } : {}),
        ...(typeof item.diocese === "string" ? { diocese: normaliseInline(item.diocese) } : {}),
      };
    case "devotion":
      return {
        ...item,
        title: normaliseInline(item.title),
        summary: normaliseInline(item.summary),
        ...(typeof item.practiceText === "string"
          ? { practiceText: normaliseMultiline(item.practiceText) }
          : {}),
      };
    case "liturgy":
      return {
        ...item,
        title: normaliseInline(item.title),
        ...(typeof item.summary === "string" ? { summary: normaliseInline(item.summary) } : {}),
        body: normaliseMultiline(item.body),
      };
    case "guide":
      return {
        ...item,
        title: normaliseInline(item.title),
        summary: normaliseInline(item.summary),
        ...(typeof item.bodyText === "string"
          ? { bodyText: normaliseMultiline(item.bodyText) }
          : {}),
        ...(Array.isArray(item.steps)
          ? {
              steps: item.steps.map((s) => ({
                ...s,
                title: typeof s.title === "string" ? normaliseInline(s.title) : s.title,
                body: typeof s.body === "string" ? normaliseMultiline(s.body) : s.body,
              })),
            }
          : {}),
      };
  }
}

export function formatIngestedItems(items: IngestedItem[]): IngestedItem[] {
  return items.map(formatIngestedItem);
}
