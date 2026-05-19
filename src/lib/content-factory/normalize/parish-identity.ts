/**
 * Parish identity validator (spec §12).
 *
 * The Parish builder needs a usable identity before it can persist
 * a row: a parish name, a city, a country, plus the website /
 * diocese when available. This module:
 *
 *   - validates the candidate fields look real
 *   - rejects parish-adjacent pages that are NOT parish records
 *     (school, bulletin, staff, livestream, donation)
 *   - emits a duplicate fingerprint for dedupe (normalised name +
 *     city + country)
 */

export type ParishIdentityFields = {
  name?: string | null;
  city?: string | null;
  country?: string | null;
  website?: string | null;
  diocese?: string | null;
};

export type ParishIdentityResult = {
  ok: boolean;
  missing: ReadonlyArray<string>;
  reason: string;
};

export function validateParishIdentity(fields: ParishIdentityFields): ParishIdentityResult {
  const missing: string[] = [];
  if (!fields.name || fields.name.trim().length < 3) missing.push("name");
  if (!fields.city || fields.city.trim().length < 2) missing.push("city");
  if (!fields.country || fields.country.trim().length < 2) missing.push("country");
  if (missing.length > 0) {
    return {
      ok: false,
      missing,
      reason: `Parish identity incomplete: missing ${missing.join(", ")}`,
    };
  }
  return {
    ok: true,
    missing: [],
    reason: "Parish identity complete",
  };
}

/**
 * Detect parish-adjacent pages that should be rejected — schools,
 * bulletins, staff directories, livestreams, donation pages.
 * Returns a non-null `category` when the page should be rejected.
 */
export function classifyParishPage(opts: { title?: string | null; body?: string | null }): {
  category: string | null;
  reason: string;
} {
  const combined = `${opts.title ?? ""}\n${opts.body ?? ""}`;
  const tests: Array<{ category: string; pattern: RegExp; reason: string }> = [
    {
      category: "school",
      pattern: /\b(catholic|parochial)?\s*(elementary|middle|high|grammar|prep)\s+school\b/i,
      reason: "Page is about a school, not a parish",
    },
    {
      category: "school",
      pattern: /\bschool\s+(enrollment|admissions|tuition|calendar)\b/i,
      reason: "Page is about school enrollment/admissions",
    },
    {
      category: "bulletin",
      pattern: /\bweekly\s+bulletin\b/i,
      reason: "Page is a parish bulletin, not a parish identity record",
    },
    {
      category: "staff",
      pattern: /\bstaff\s+(directory|listing|page|members)\b/i,
      reason: "Page is a staff directory",
    },
    {
      category: "livestream",
      pattern: /\b(watch|stream)\s+(live|mass)\b|\blivestream\b/i,
      reason: "Page is a livestream",
    },
    {
      category: "donation",
      pattern: /\b(give|donate|donation|stewardship)\s+(now|today|page)?\b/i,
      reason: "Page is a donation/stewardship page",
    },
  ];
  for (const t of tests) {
    if (t.pattern.test(combined)) {
      return { category: t.category, reason: t.reason };
    }
  }
  return { category: null, reason: "" };
}

/**
 * Build a duplicate-detection fingerprint from a parish identity.
 * Same fingerprint = same parish (so the worker can skip on
 * persistence). Implementation: lowercase + strip non-word chars
 * from name + city + country.
 */
export function parishDuplicateFingerprint(fields: ParishIdentityFields): string {
  const norm = (s?: string | null): string =>
    (s ?? "")
      .toLowerCase()
      // Strip apostrophes and curly quotes first so "St. Patrick's"
      // and "St Patricks" yield the same token sequence.
      .replace(/['’‘`]/g, "")
      .replace(/[^\p{Letter}\p{Number}]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  return [norm(fields.name), norm(fields.city), norm(fields.country)].join("|");
}
