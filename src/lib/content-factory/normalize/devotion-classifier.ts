/**
 * Devotion + Consecration classifier (spec §13).
 *
 * A page is *factory-ready* devotion content only when it has an
 * actual practice structure (steps, prayers, frequency) — not when
 * it is an article, retreat ad, livestream, or event listing.
 *
 * For consecrations the bar is even higher: the page must contain a
 * day-by-day structure (33-day Marian consecration, 9-day novena
 * leading to consecration, etc.). Single-page articles about a
 * consecration do not qualify.
 */

const REJECT_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bwatch\s+(live|the)\b/i, reason: "Livestream page" },
  { pattern: /\blivestream\b/i, reason: "Livestream page" },
  { pattern: /\bregister\s+for\s+(our|the|this)\s+\w+\s+retreat/i, reason: "Retreat registration" },
  { pattern: /\bevent\s+(listing|page|calendar)\b/i, reason: "Event listing" },
  { pattern: /\badvertisement\b/i, reason: "Advertisement" },
  { pattern: /\bsponsored\s+post\b/i, reason: "Sponsored / advertisement" },
  { pattern: /\bclick\s+here\s+to\s+register\b/i, reason: "Event registration" },
];

const DEVOTION_PRACTICE_CUES: ReadonlyArray<RegExp> = [
  /\bbegin\s+(with|by)\b/i,
  /\bdaily\s+at\b/i,
  /\bevery\s+(day|morning|evening)\b/i,
  /\brecite\s+the\b/i,
  /\b(?:practice|practise)\s+this\b/i,
  /\bsteps?\s*:\s*\d/i,
  /\bstep\s+\d/i,
  /\bfirst,?\s+begin\b/i,
  /\bthen\s+pray\b/i,
];

const CONSECRATION_DAY_CUES: ReadonlyArray<RegExp> = [
  /\b33[-\s]?day\s+consecration\b/i,
  /\b9[-\s]?day\b/i,
  /\bday\s+\d+\s+of\s+\d+\b/i,
  /\bday\s+1\s+through\s+day\s+\d+\b/i,
  /\b(thirty\s+three|nine)[-\s]?day\b/i,
];

export type DevotionClassification = {
  approved: boolean;
  reason: string;
  /** "devotion" or "consecration" — which kind the page looks like. */
  detectedKind?: "devotion" | "consecration" | null;
};

export function classifyDevotionPage(opts: {
  title?: string | null;
  body?: string | null;
  kind?: "devotion" | "consecration" | null;
}): DevotionClassification {
  const combined = `${opts.title ?? ""}\n${opts.body ?? ""}`;
  for (const r of REJECT_PATTERNS) {
    if (r.pattern.test(combined)) {
      return { approved: false, reason: r.reason };
    }
  }
  const isConsecration = opts.kind === "consecration" || /\bconsecration\b/i.test(combined);

  if (isConsecration) {
    const dayCues = CONSECRATION_DAY_CUES.filter((p) => p.test(combined)).length;
    if (dayCues === 0) {
      return {
        approved: false,
        reason: "Consecration page lacks a day-by-day structure",
        detectedKind: "consecration",
      };
    }
    return {
      approved: true,
      reason: `Consecration page accepted (${dayCues} day-cues)`,
      detectedKind: "consecration",
    };
  }

  const practiceCues = DEVOTION_PRACTICE_CUES.filter((p) => p.test(combined)).length;
  if (practiceCues === 0) {
    return {
      approved: false,
      reason: "Devotion page lacks a practice structure",
      detectedKind: "devotion",
    };
  }
  return {
    approved: true,
    reason: `Devotion page accepted (${practiceCues} practice cues)`,
    detectedKind: "devotion",
  };
}

/**
 * Detect when a consecration spans multiple pages so the worker can
 * fetch each day page. Mirrors `detectMultiPageNovenaHints()`.
 */
export function detectMultiDayConsecrationHints(opts: {
  links: ReadonlyArray<{ url: string; text: string }>;
}): Array<{ dayNumber: number; url: string }> {
  const hits: Array<{ dayNumber: number; url: string }> = [];
  const seen = new Set<number>();
  for (const link of opts.links) {
    const text = link.text.trim().toLowerCase();
    const url = link.url.toLowerCase();
    const m = text.match(/^day\s+(\d{1,2})\b/) ?? url.match(/[/_-]day[-_]?(\d{1,2})\b/);
    if (m) {
      const dayNumber = parseInt(m[1], 10);
      if (dayNumber >= 1 && dayNumber <= 99 && !seen.has(dayNumber)) {
        seen.add(dayNumber);
        hits.push({ dayNumber, url: link.url });
      }
    }
  }
  return hits;
}
