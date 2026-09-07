/**
 * Cross-source verifier (spec §11). Validates important facts against
 * one or more approved validation sources and emits structured
 * `ValidationEvidence` records. The publish gate consumes these
 * records to decide whether a package can publish automatically.
 *
 * Rules:
 *   - If two validation sources conflict, do NOT publish automatically.
 *   - If validation evidence is missing for required sensitive facts
 *     (apparition approval, saint feast day, scripture references,
 *     novena day count, rosary mystery count, sacrament identity),
 *     do NOT publish automatically.
 *   - If every required-fact verification matches with high confidence,
 *     publishing is allowed.
 */

export type VerifyMatchStatus = "MATCH" | "MISMATCH" | "MISSING" | "AMBIGUOUS";

export interface ValidationEvidence {
  fieldVerified: string;
  sourceUsed: string;
  matchStatus: VerifyMatchStatus;
  confidence: number;
  conflict: boolean;
  failureReason: string | null;
}

export interface VerifyInput {
  contentType:
    | "PRAYER"
    | "SAINT"
    | "APPARITION"
    | "DEVOTION"
    | "NOVENA"
    | "ROSARY"
    | "CONSECRATION"
    | "SACRAMENT"
    | "CHURCH_DOCUMENT"
    | "LITURGICAL"
    | "PARISH";
  fields: Record<string, unknown>;
  /** Independent validation sources to compare against. */
  validationSources: Array<{
    host: string;
    fields: Record<string, unknown>;
  }>;
}

export interface VerifyOutcome {
  evidence: ValidationEvidence[];
  hasConflict: boolean;
  missingRequired: string[];
  /** True when every required fact for this content type matched. */
  publishAllowed: boolean;
}

/**
 * Required-for-publish fact list, by content type. Spec §11.
 */
export const REQUIRED_FACTS: Record<VerifyInput["contentType"], string[]> = {
  PRAYER: ["prayerTitle", "prayerText"],
  SAINT: ["saintName", "feastDay"],
  APPARITION: ["apparitionTitle", "approvalStatus"],
  DEVOTION: ["devotionTitle"],
  NOVENA: ["novenaTitle", "duration"],
  ROSARY: ["title", "mysterySets"],
  CONSECRATION: ["consecrationTitle", "duration"],
  SACRAMENT: ["sacramentKey"],
  CHURCH_DOCUMENT: ["historyType", "title"],
  LITURGICAL: ["liturgyTitle"],
  PARISH: ["parishName", "city"],
};

function normalize(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `[${value.length}]`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/**
 * Reduce a calendar day to "MM-DD", whichever way the source printed it.
 * Extractors emit the schema shape ("10-04"); an independent page prints
 * "October 4" or "4 October". Comparing those as raw strings made a correct
 * feast day look like a cross-source CONFLICT and blocked the publish. Returns
 * null for anything that is not unambiguously a month-and-day, so nothing else
 * is affected.
 */
function feastDateKey(value: string): string | null {
  const v = value.trim().toLowerCase();
  const iso = /^(\d{1,2})-(\d{1,2})$/.exec(v);
  if (iso) {
    const month = Number(iso[1]);
    const day = Number(iso[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return null;
  }
  const named =
    /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/.exec(v) ??
    /^(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)$/.exec(v);
  if (!named) return null;
  const [first, second] = [named[1] ?? "", named[2] ?? ""];
  const monthWord = /^\d/.test(first) ? second : first;
  const dayWord = /^\d/.test(first) ? first : second;
  const monthIndex = MONTH_NAMES.indexOf(monthWord);
  const day = Number(dayWord);
  if (monthIndex < 0 || !(day >= 1 && day <= 31)) return null;
  return `${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function compare(a: unknown, b: unknown): VerifyMatchStatus {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return "MISSING";
  if (na === nb) return "MATCH";
  // The same calendar day written two different ways is the same fact.
  const ka = feastDateKey(na);
  const kb = feastDateKey(nb);
  if (ka && kb) return ka === kb ? "MATCH" : "MISMATCH";
  // Fuzzy: substring overlap on long strings.
  if (na.length > 10 && nb.length > 10 && (na.includes(nb) || nb.includes(na))) {
    return "MATCH";
  }
  // Special-case array sizes: e.g. mysterySets[3] vs mysterySets[3].
  if (na.startsWith("[") && nb.startsWith("[") && na === nb) return "MATCH";
  return "MISMATCH";
}

export function verifyCrossSource(input: VerifyInput): VerifyOutcome {
  const required = REQUIRED_FACTS[input.contentType];
  const evidence: ValidationEvidence[] = [];
  const missingRequired: string[] = [];

  for (const field of required) {
    const ours = input.fields[field];
    if (ours == null || ours === "") {
      missingRequired.push(field);
      evidence.push({
        fieldVerified: field,
        sourceUsed: "self",
        matchStatus: "MISSING",
        confidence: 0,
        conflict: false,
        failureReason: `Required field ${field} missing from candidate package.`,
      });
      continue;
    }

    // No validation sources at all → record a MISSING evidence row.
    if (input.validationSources.length === 0) {
      evidence.push({
        fieldVerified: field,
        sourceUsed: "(none)",
        matchStatus: "MISSING",
        confidence: 0,
        conflict: false,
        failureReason: `No validation source available for ${field}.`,
      });
      continue;
    }

    // Compare against each validation source. We treat a single MATCH
    // as success even if other sources are MISSING.
    let matches = 0;
    let mismatches = 0;
    for (const source of input.validationSources) {
      const status = compare(ours, source.fields[field]);
      evidence.push({
        fieldVerified: field,
        sourceUsed: source.host,
        matchStatus: status,
        confidence:
          status === "MATCH" ? 0.9 : status === "MISMATCH" ? 0.1 : status === "MISSING" ? 0 : 0.5,
        conflict: false,
        failureReason: status === "MISMATCH" ? `Value differs from ${source.host}.` : null,
      });
      if (status === "MATCH") matches += 1;
      if (status === "MISMATCH") mismatches += 1;
    }

    // Conflict = at least one match AND at least one mismatch.
    if (matches > 0 && mismatches > 0) {
      for (const row of evidence) {
        if (row.fieldVerified === field) row.conflict = true;
      }
    }
  }

  const hasConflict = evidence.some((row) => row.conflict);
  const publishAllowed =
    missingRequired.length === 0 &&
    !hasConflict &&
    required.every((field) =>
      evidence.some((row) => row.fieldVerified === field && row.matchStatus === "MATCH"),
    );

  return {
    evidence,
    hasConflict,
    missingRequired,
    publishAllowed,
  };
}
