/**
 * Parses a saint's biography string into the labelled sections required by
 * the saint detail page: story, historical background, important dates,
 * major contributions to the Church.
 *
 * Two formats are accepted:
 *
 *   1) Structured headers — when the ingestion pipeline emits a biography
 *      with explicit "Story:" / "Historical background:" / "Important dates:"
 *      / "Major contributions:" markers (any colon, hash, or markdown
 *      header). This is the preferred, lossless form.
 *
 *   2) Free-form prose — fall back to a heuristic split:
 *        - first paragraph as story
 *        - paragraphs containing year mentions ("1226", "AD 235")
 *          go to "important dates"
 *        - the remaining paragraphs become "historical background"
 *
 * The component renders any non-empty section, so a saint with only a
 * one-paragraph biography still looks correct (just the story section).
 */

export type SaintSections = {
  story: string;
  background: string;
  importantDates: string;
  contributions: string;
};

const HEADER_ALIASES: Record<keyof SaintSections, RegExp[]> = {
  story: [/^story\b/i, /^biography\b/i, /^life\b/i],
  background: [/^historical\s+background\b/i, /^background\b/i, /^context\b/i],
  importantDates: [/^important\s+dates\b/i, /^key\s+dates\b/i, /^timeline\b/i, /^dates\b/i],
  contributions: [
    /^major\s+contributions(\s+to\s+the\s+church)?\b/i,
    /^contributions\b/i,
    /^legacy\b/i,
    /^impact\b/i,
  ],
};

function matchSection(line: string): keyof SaintSections | null {
  // Strip markdown-style markers and leading punctuation.
  const cleaned = line
    .replace(/^[#>*\s-]+/, "")
    .replace(/[:：].*$/, "")
    .trim();
  for (const key of Object.keys(HEADER_ALIASES) as (keyof SaintSections)[]) {
    for (const re of HEADER_ALIASES[key]) {
      if (re.test(cleaned)) return key;
    }
  }
  return null;
}

function isHeaderLine(line: string): boolean {
  // A line is treated as a header when it ends with a colon, is wrapped in
  // markdown ** ** bold, or starts with a # — but only if it also matches
  // one of our known section names. This avoids false positives where the
  // body happens to contain the word "story:" mid-paragraph.
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (!/[:：]/.test(trimmed) && !/^#/.test(trimmed) && !/^\*\*.+\*\*$/.test(trimmed)) return false;
  return matchSection(trimmed) !== null;
}

export function parseSaintBiography(raw: string | null | undefined): SaintSections {
  const out: SaintSections = {
    story: "",
    background: "",
    importantDates: "",
    contributions: "",
  };
  if (!raw) return out;

  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  // Pass 1: structured headers
  if (lines.some(isHeaderLine)) {
    let current: keyof SaintSections | null = "story";
    const buffers: Record<keyof SaintSections, string[]> = {
      story: [],
      background: [],
      importantDates: [],
      contributions: [],
    };
    for (const rawLine of lines) {
      if (isHeaderLine(rawLine)) {
        const next = matchSection(rawLine);
        if (next) {
          current = next;
          continue;
        }
      }
      if (current) buffers[current].push(rawLine);
    }
    out.story = buffers.story.join("\n").trim();
    out.background = buffers.background.join("\n").trim();
    out.importantDates = buffers.importantDates.join("\n").trim();
    out.contributions = buffers.contributions.join("\n").trim();
    if (out.story || out.background || out.importantDates || out.contributions) return out;
  }

  // Pass 2: prose heuristic split
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return out;
  out.story = paragraphs[0];
  const yearRe = /\b(1[0-9]{3}|20[0-2][0-9]|9[0-9]{2}|[1-8][0-9]{2})\b/;
  const dateBuckets: string[] = [];
  const backgroundBuckets: string[] = [];
  for (const para of paragraphs.slice(1)) {
    if (yearRe.test(para) && para.length < 600) dateBuckets.push(para);
    else backgroundBuckets.push(para);
  }
  out.importantDates = dateBuckets.join("\n\n");
  out.background = backgroundBuckets.join("\n\n");
  return out;
}
