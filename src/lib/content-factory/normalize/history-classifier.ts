/**
 * Church history classifier (spec §11).
 *
 * The History builder must:
 *   - require an approved history category
 *   - reject news articles and generic blog posts
 *   - validate that the date/era field looks like a real Church date
 *
 * Approved categories come from the existing history contract; we
 * import the canonical list directly to stay in lockstep.
 */

import { VALID_HISTORY_TYPES } from "../../content-qa/contracts/history";

/** Canonical history categories — must match the history contract. */
export const APPROVED_HISTORY_CATEGORIES: ReadonlyArray<string> = VALID_HISTORY_TYPES;

const NEWS_BLOG_PATTERNS: ReadonlyArray<RegExp> = [
  /\bpublished\s+\w+\s+\d{1,2},\s+20\d{2}\b/i,
  /\bby\s+\w+\s+\w+\s+\|\s+\w+\s+\d{1,2},\s+20\d{2}\b/i,
  /\bbreaking\s+news\b/i,
  /\blatest\s+news\b/i,
  /\bclick\s+here\s+to\s+read\s+more\b/i,
  /\bsubscribe\s+to\s+our\s+newsletter\b/i,
  /\bshare\s+this\s+article\b/i,
  /\bcomments?\s*\(\d+\)/i,
  /\bblog\s+post\b/i,
  /\bopinion\s+piece\b/i,
];

const ERA_OR_DATE_PATTERNS: ReadonlyArray<RegExp> = [
  /\b\d{1,4}\s*(?:ad|bc|bce|ce)\b/i,
  /\b\d{3,4}[-–]\d{2,4}\b/,
  /\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|twenty[-\s]first)\s+century\b/i,
  /\b\d{4}\b/, // bare year — last-resort
];

export type HistoryClassification = {
  approved: boolean;
  reason: string;
  detectedCategory?: string | null;
};

/**
 * Decide whether a candidate history page is approved-category
 * content (good) vs. a news article / blog post (reject).
 */
export function classifyHistoryPage(opts: {
  title?: string | null;
  body?: string | null;
  category?: string | null;
}): HistoryClassification {
  const combined = `${opts.title ?? ""}\n${opts.body ?? ""}`;
  const newsHits = NEWS_BLOG_PATTERNS.filter((p) => p.test(combined)).length;
  if (newsHits >= 2) {
    return {
      approved: false,
      reason: `Page reads as a news article / blog post (${newsHits} cues matched)`,
    };
  }
  const cat = opts.category?.trim() ?? "";
  if (cat && !APPROVED_HISTORY_CATEGORIES.includes(cat)) {
    return {
      approved: false,
      reason: `Category '${cat}' is not in the approved history list`,
      detectedCategory: cat,
    };
  }
  if (!ERA_OR_DATE_PATTERNS.some((p) => p.test(combined))) {
    return {
      approved: false,
      reason: "No era / date markers found in title or body",
    };
  }
  return {
    approved: true,
    reason: "History page has an approved category and date markers",
    detectedCategory: cat || null,
  };
}
