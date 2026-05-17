/**
 * Prayer extractor (Section 8). Takes raw page text and produces a
 * typed Prayer package payload ready for the strict QA contract.
 *
 * Extracts:
 *   - prayer type      — classifier-derived (Marian, Eucharistic, Morning, etc.)
 *   - prayer name      — title heuristic
 *   - prayer text      — the actual body, stripped of bylines / nav
 *   - category         — same as prayer type bucket
 *   - source URL / host / language / checksum
 *
 * Pure function; reports `complete` and per-field provenance.
 */

import { checksumString } from "../../ingestion/checksum";

export type PrayerExtractionResult = {
  complete: boolean;
  payload: {
    prayerType?: string;
    prayerName?: string;
    prayerText?: string;
    category?: string;
    sourceUrl?: string;
    sourceHost?: string;
    language?: string;
    contentChecksum?: string;
  };
  provenance: Record<string, string>;
  missingFields: string[];
};

const PRAYER_TYPE_HINTS: Array<{ kind: string; re: RegExp }> = [
  {
    kind: "Marian prayer",
    re: /\b(?:hail\s+mary|memorare|holy\s+queen|regina\s+coeli|mother\s+of\s+god)\b/i,
  },
  {
    kind: "Eucharistic prayer",
    re: /\b(?:eucharist|holy\s+communion|blessed\s+sacrament|adoration)\b/i,
  },
  {
    kind: "Morning prayer",
    re: /\b(?:morning\s+(?:prayer|offering)|at\s+the\s+start\s+of\s+the\s+day)\b/i,
  },
  { kind: "Evening prayer", re: /\b(?:evening\s+(?:prayer|offering)|night\s+prayer|compline)\b/i },
  { kind: "Repentance prayer", re: /\b(?:act\s+of\s+contrition|confession\s+prayer|mercy)\b/i },
  { kind: "Saint intercession prayer", re: /\b(?:intercession|patron\s+saint|pray\s+for\s+us)\b/i },
  { kind: "Litany", re: /\blitany\b/i },
  { kind: "Rosary prayer", re: /\b(?:rosary|decade|mystery)\b/i },
  { kind: "Chaplet prayer", re: /\bchaplet\b/i },
  { kind: "Novena prayer", re: /\bnovena\b/i },
  { kind: "Act of contrition", re: /\bact\s+of\s+contrition\b/i },
  { kind: "Blessing", re: /\bblessing\b/i },
  { kind: "Consecration prayer", re: /\bconsecration\b/i },
];

function classifyPrayerType(title: string, body: string): string | undefined {
  const text = `${title}\n${body}`;
  for (const h of PRAYER_TYPE_HINTS) {
    if (h.re.test(text)) return h.kind;
  }
  return "Traditional Catholic prayer";
}

const NAV_GARBAGE_RE = [
  /\b(?:share|tweet|email|print)\s+this\b/i,
  /\b(?:read\s+more|continue\s+reading)\b/i,
  /\b(?:home|menu|search|sign\s+in)\b/i,
];

function stripNav(body: string): string {
  let out = body;
  for (const re of NAV_GARBAGE_RE) {
    out = out.replace(new RegExp(re.source, "gi"), "");
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

function sourceHostFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export function extractPrayer(args: {
  title?: string;
  body: string;
  sourceUrl?: string;
  language?: string;
  category?: string;
}): PrayerExtractionResult {
  const provenance: Record<string, string> = {};
  const missingFields: string[] = [];

  const prayerName = args.title?.trim() || undefined;
  if (prayerName) provenance.prayerName = "title input";
  else missingFields.push("prayerName");

  const prayerText = stripNav(args.body ?? "");
  if (prayerText && prayerText.length >= 20) {
    provenance.prayerText = "body stripped of nav";
  } else {
    missingFields.push("prayerText");
  }

  const prayerType = classifyPrayerType(prayerName ?? "", prayerText);
  if (prayerType) provenance.prayerType = "regex classifier";

  const category = args.category?.trim() || prayerType;
  if (category) provenance.category = args.category ? "input" : "derived from prayerType";

  const sourceHost = sourceHostFromUrl(args.sourceUrl);
  if (sourceHost) provenance.sourceHost = "URL parse";
  const language = args.language ?? "en";
  provenance.language = args.language ? "input" : "default en";

  const contentChecksum = checksumString(`${prayerName ?? ""}\n${prayerText}`);
  provenance.contentChecksum = "computed";

  return {
    complete: missingFields.length === 0,
    payload: {
      prayerType,
      prayerName,
      prayerText,
      category,
      sourceUrl: args.sourceUrl,
      sourceHost,
      language,
      contentChecksum,
    },
    provenance,
    missingFields,
  };
}
