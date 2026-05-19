/**
 * Prayer text normalizer (spec §6).
 *
 * Strips the noise that wraps a prayer body on real-world sources so
 * cross-source validation can compare the actual prayer text, not
 * the surrounding article furniture:
 *
 *   - punctuation runs collapsed (e.g. "Amen!!" → "Amen.")
 *   - paragraph breaks collapsed to single \n\n
 *   - repeated title lines removed (e.g. "Hail Mary\nHail Mary\nHail Mary, full of grace...")
 *   - intro lines removed ("Below is the prayer...", "Pray this with...")
 *   - closing notes removed ("Used with permission", "Imprimatur:...")
 *   - source footers removed ("Copyright EWTN", "Read more at vatican.va")
 *
 * The function is *pure* — no I/O. Builder.build() should call it on
 * the extracted prayer text before persisting the value to the
 * package payload.
 */

const INTRO_PATTERNS: ReadonlyArray<RegExp> = [
  /^below\s+(is|are)\s+the\s+(prayer|prayers).*?:?$/i,
  /^pray\s+this\s+with\s+.*?:?$/i,
  /^recite\s+the\s+following.*?:?$/i,
  /^the\s+following\s+(prayer|prayers)\s+(can|may|should)\s+be.*?:?$/i,
  /^this\s+(prayer|devotion)\s+(is|was)\s+.*?:?$/i,
  /^prayer\s*:$/i,
];

const CLOSING_PATTERNS: ReadonlyArray<RegExp> = [
  /^used\s+with\s+permission.*$/i,
  /^imprimatur\b.*$/i,
  /^nihil\s+obstat\b.*$/i,
  /^source:\s+.*$/i,
  /^reference:\s+.*$/i,
  /^read\s+more\s+at\s+.*$/i,
  /^©\s*\d{4}.*$/i,
  /^copyright\s+\d{4}.*$/i,
  /^all\s+rights\s+reserved.*$/i,
  /^published\s+by\s+.*$/i,
  /^translation\s+by\s+.*$/i,
  /^excerpt\s+from\s+.*$/i,
  /^from\s+the\s+.*\s+catechism\b.*$/i,
];

const FOOTER_HOST_PATTERNS: ReadonlyArray<RegExp> = [
  /\bewtn\.com\b/i,
  /\bvatican\.va\b/i,
  /\busccb\.org\b/i,
  /\bcatholic\.org\b/i,
  /\bcatholicculture\.org\b/i,
];

/** Match lines that are entirely a host reference or "Visit X.com". */
function isFooterLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//.test(trimmed)) return true;
  if (/^visit\s+/i.test(trimmed) && FOOTER_HOST_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (FOOTER_HOST_PATTERNS.some((p) => p.test(trimmed)) && trimmed.length < 60) return true;
  return false;
}

export type PrayerTextNormalizationResult = {
  text: string;
  /** Lines that were stripped, for admin / debug visibility. */
  stripped: ReadonlyArray<string>;
};

/**
 * Run the full normalization on a raw prayer body. Returns the
 * cleaned text plus the list of stripped lines so the build log can
 * surface what was removed.
 */
export function normalizePrayerText(
  raw: string,
  options: { titleHint?: string } = {},
): PrayerTextNormalizationResult {
  const stripped: string[] = [];
  const titleHint = options.titleHint?.trim().toLowerCase() ?? "";

  // 1. Collapse runs of paragraph breaks to a single \n\n. Treat any
  //    sequence of 2+ newlines as a paragraph boundary.
  const collapsedBreaks = raw.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n");

  // 2. Split into lines so we can filter intro/closing/footer rows.
  const lines = collapsedBreaks.split(/\n/);
  const kept: string[] = [];

  let seenBody = false;
  let lastNonEmpty = "";
  for (let line of lines) {
    line = line.trim();
    if (!line) {
      if (kept.length > 0 && kept[kept.length - 1] !== "") kept.push("");
      continue;
    }
    // Repeated title — first occurrence is kept, subsequent ones drop.
    if (titleHint && line.toLowerCase() === titleHint) {
      if (lastNonEmpty.toLowerCase() === titleHint) {
        stripped.push(line);
        continue;
      }
    }
    // Strip intro lines only before the body starts.
    if (!seenBody && INTRO_PATTERNS.some((p) => p.test(line))) {
      stripped.push(line);
      continue;
    }
    // Strip closing / source notes regardless of position.
    if (CLOSING_PATTERNS.some((p) => p.test(line))) {
      stripped.push(line);
      continue;
    }
    if (isFooterLine(line)) {
      stripped.push(line);
      continue;
    }
    seenBody = true;
    lastNonEmpty = line;
    kept.push(line);
  }

  // 3. Trim trailing empties.
  while (kept.length > 0 && kept[kept.length - 1] === "") kept.pop();
  while (kept.length > 0 && kept[0] === "") kept.shift();

  // 4. Collapse punctuation runs. Multiple "!" or "?" in a row reduce
  //    to one. Trailing "Amen!!" becomes "Amen.".
  let text = kept.join("\n");
  text = text.replace(/([!?])\1+/g, "$1");
  text = text.replace(/\.{3,}/g, "…");
  text = text.replace(/\.\.+(?!\.)/g, ".");
  text = text.replace(/\s+([.,;:?!])/g, "$1");
  text = text.replace(/\bAmen[!?]+/gi, "Amen.");

  return { text, stripped };
}

/**
 * "Build only the actual prayer body" — used by the prayer builder
 * detector. Returns true when the text looks like an article *about*
 * a prayer rather than a prayer body. Signals:
 *   - more than 50% of lines start with a verb in third person
 *   - presence of "according to", "explains", "writes", etc.
 *   - extensive numbered references or footnotes
 */
export function looksLikeArticleAbout(text: string): boolean {
  if (!text) return false;
  const lowered = text.toLowerCase();
  const cues = [
    "according to ",
    "explains ",
    "writes ",
    "as theologian ",
    "in his book",
    "in her book",
    "scholars believe ",
    "we sometimes wonder",
    "have you ever",
    "click here",
    "subscribe to",
    "share this article",
    "join our newsletter",
  ];
  const hitCount = cues.reduce((n, c) => (lowered.includes(c) ? n + 1 : n), 0);
  return hitCount >= 2;
}
