/**
 * Novena day parser (spec §8).
 *
 * Parses the day structure out of a novena source document. The
 * factory needs every nine days present before persisting; the
 * parser tolerates the many ways real sources express day numbers:
 *
 *   - "Day 1", "Day 2", ..., "Day 9"
 *   - "First Day", "Second Day", ..., "Ninth Day"
 *   - "Day One", "Day Two", ..., "Day Nine"
 *   - Roman numerals: I., II., III., ..., IX.
 *   - Collapsed/inline sections (h2/h3 headings followed by text)
 *   - Ordered lists (<ol><li>...</li></ol>)
 *   - Repeated headings (multiple "Day 1" sections — first wins)
 *   - Page anchors (#day-1, #firstday)
 *
 * The parser returns a `{ days: Day[]; missing: number[] }` shape;
 * the builder uses `missing.length === 0` as the "complete novena"
 * gate before persistence. `days.length < 9` triggers a
 * `build_failed_missing_required_fields` outcome with the missing
 * day numbers in the failureReason.
 */

const WRITTEN_NUMBERS: Record<string, number> = {
  one: 1,
  first: 1,
  "1st": 1,
  two: 2,
  second: 2,
  "2nd": 2,
  three: 3,
  third: 3,
  "3rd": 3,
  four: 4,
  fourth: 4,
  "4th": 4,
  five: 5,
  fifth: 5,
  "5th": 5,
  six: 6,
  sixth: 6,
  "6th": 6,
  seven: 7,
  seventh: 7,
  "7th": 7,
  eight: 8,
  eighth: 8,
  "8th": 8,
  nine: 9,
  ninth: 9,
  "9th": 9,
};

const ROMAN_NUMERALS: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
};

export type ParsedNovenaDay = {
  dayNumber: number;
  heading: string;
  body: string;
};

export type ParseNovenaDaysResult = {
  days: ParsedNovenaDay[];
  missing: number[];
  /** Extra debug info — the raw heading strings the parser scanned. */
  candidates: ReadonlyArray<string>;
};

/**
 * Match a heading line and return the day number it announces, or
 * null when it does not look like a day boundary.
 */
export function parseDayHeading(heading: string): number | null {
  const h = heading.trim().toLowerCase();
  if (!h) return null;

  // "Day 1", "Day 12" — only 1-9 are valid novena days, but the
  // parser still recognises higher numbers so the builder can
  // surface a clear "too many days" error.
  const dayN = h.match(/^day\s+(\d{1,2})\b/);
  if (dayN) return parseInt(dayN[1], 10);

  // "First Day", "Second Day"
  const writtenDay = h.match(
    /^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)\s+day\b/,
  );
  if (writtenDay && WRITTEN_NUMBERS[writtenDay[1]]) return WRITTEN_NUMBERS[writtenDay[1]];

  // "Day One", "Day Two"
  const dayWritten = h.match(/^day\s+(one|two|three|four|five|six|seven|eight|nine)\b/);
  if (dayWritten && WRITTEN_NUMBERS[dayWritten[1]]) return WRITTEN_NUMBERS[dayWritten[1]];

  // Roman numerals — "I.", "II.", "III." up to "IX.". A trailing
  // `\b` would fail after the period (non-word + end-of-string), so
  // we explicitly anchor to "end-of-string OR whitespace + optional
  // 'day'".
  const roman = h.match(/^(i{1,3}|iv|v|vi{0,3}|ix)\.(?:\s*(day)?\s*)?$/);
  if (roman && ROMAN_NUMERALS[roman[1]] && ROMAN_NUMERALS[roman[1]] <= 9)
    return ROMAN_NUMERALS[roman[1]];

  // Page anchor / id-style: "day-1", "day_1", "day1"
  const slug = h.match(/^day[-_]?(\d{1,2})\b/);
  if (slug) return parseInt(slug[1], 10);

  return null;
}

export type NovenaSection = {
  heading: string;
  body: string;
};

/**
 * Parse a flat list of (heading, body) sections into a novena day
 * map. Repeated day headings — multiple "Day 1" sections — are
 * resolved by keeping the *first* occurrence so misnumbered tails on
 * blog posts do not silently overwrite the real Day 1.
 */
export function parseNovenaDays(sections: ReadonlyArray<NovenaSection>): ParseNovenaDaysResult {
  const byDay = new Map<number, ParsedNovenaDay>();
  const candidates: string[] = [];

  for (const section of sections) {
    candidates.push(section.heading);
    const dayNumber = parseDayHeading(section.heading);
    if (dayNumber === null) continue;
    if (dayNumber < 1 || dayNumber > 9) continue;
    if (byDay.has(dayNumber)) continue; // first wins
    byDay.set(dayNumber, {
      dayNumber,
      heading: section.heading.trim(),
      body: section.body.trim(),
    });
  }

  const days = Array.from(byDay.values()).sort((a, b) => a.dayNumber - b.dayNumber);
  const missing: number[] = [];
  for (let d = 1; d <= 9; d++) {
    if (!byDay.has(d)) missing.push(d);
  }
  return { days, missing, candidates };
}

/**
 * Detect when a novena page references a sibling page for one or
 * more days (so the worker can enqueue a fetch for each missing
 * day page). Spec §8 — "multi page novena support".
 *
 * Returns a list of {dayNumber, url} hints. Each hint becomes a
 * source_fetch enqueue when the discovery loop replays this
 * function.
 */
export function detectMultiPageNovenaHints(opts: {
  links: ReadonlyArray<{ url: string; text: string }>;
}): Array<{ dayNumber: number; url: string }> {
  const hints: Array<{ dayNumber: number; url: string }> = [];
  for (const link of opts.links) {
    const text = link.text.trim().toLowerCase();
    const fromText = parseDayHeading(text);
    const fromUrl = parseDayHeading(link.url.toLowerCase());
    const dayNumber = fromText ?? fromUrl;
    if (dayNumber && dayNumber >= 1 && dayNumber <= 9) {
      hints.push({ dayNumber, url: link.url });
    }
  }
  // De-dupe by dayNumber, keeping the first.
  const seen = new Set<number>();
  return hints.filter((h) => {
    if (seen.has(h.dayNumber)) return false;
    seen.add(h.dayNumber);
    return true;
  });
}
