/**
 * Prayer extractor (Section 8). Takes raw page text and produces a
 * typed Prayer package payload ready for the strict QA contract.
 *
 * Extracts:
 *   - prayer type      — classifier-derived (Marian, Eucharistic, Morning, etc.)
 *   - prayer name      — title heuristic
 *   - prayer text      — the actual body, stripped of bylines / nav
 *   - category         — same as prayer type bucket
 *   - source URL / host / language
 *
 * Pure function; reports `complete` and per-field provenance. The
 * content checksum is intentionally NOT computed here — the persist
 * layer (`ingestion/persist/persist-prayer.ts`) derives the
 * package-level checksum from the canonicalised IngestedPrayer at
 * write time, which is the single authoritative checksum used for
 * dedup and change detection. Keeping this extractor free of the
 * `node:crypto`-using checksum helper also keeps it runtime-neutral
 * so it can be safely re-exported via `content-qa/index.ts` without
 * dragging Node-only modules into Edge bundles.
 */

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

const PRAYER_LANGUAGE_RE =
  /\b(amen|o\s+lord|o\s+god|o\s+jesus|hail\s+mary|glory\s+be|lord\s+have\s+mercy|we\s+beseech|grant\s+(?:us|me|that)|pray\s+for\s+us|in\s+the\s+name\s+of\s+the\s+father|i\s+(?:believe|confess|adore|love|offer|thank)|hallowed|forgive\s+us|deliver\s+us|come\s+holy\s+spirit|let\s+us\s+pray)\b/i;

function stripNav(body: string): string {
  let out = body;
  for (const re of NAV_GARBAGE_RE) {
    out = out.replace(new RegExp(re.source, "gi"), "");
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Isolate the actual prayer from intro / footer noise. When the body
 * has lines carrying prayer language, the prayer text is the span
 * from the first to the last such line — this drops leading
 * "Below is the prayer:" intros and trailing "© 2024" / "Visit …"
 * footers without discarding lines inside the prayer itself. When no
 * line carries prayer language the body is returned unchanged so the
 * caller still reports it as not-a-prayer.
 */
function trimToPrayerSpan(body: string): string {
  const lines = body.split(/\n/);
  let first = -1;
  let last = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (PRAYER_LANGUAGE_RE.test(lines[i])) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return body.trim();
  return lines
    .slice(first, last + 1)
    .join("\n")
    .trim();
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

  const prayerText = trimToPrayerSpan(stripNav(args.body ?? ""));
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
    },
    provenance,
    missingFields,
  };
}
