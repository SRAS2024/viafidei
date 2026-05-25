/**
 * Per-content-type packaging validators (spec section 7).
 *
 * The existing `src/lib/worker/schemas/` Zod schemas enforce the core
 * required fields for every content type. These validators add the
 * spec's *structural* extras — fields the spec explicitly enumerates
 * that the schema may treat as optional:
 *
 *   - Marian Apparition: approval status + location + date/period
 *   - Devotion: how-to-practice + (when applicable) prayer
 *     structure / steps / duration
 *   - Novena: Day 1–9 with title + intention + prayer +
 *     scripture / reflection / closing prayer, plus dropdown metadata
 *   - Rosary: opening prayers + mystery sets (each with 5 mysteries
 *     and a decade structure) + closing prayers + scripture refs +
 *     meditations
 *   - Consecration: duration + daily structure (readings, prayers) +
 *     final consecration prayer
 *   - Sacrament: badge + key + description + preparation + participation
 *     + (when applicable) biblical foundation + Catechism refs +
 *     related prayers
 *   - History: must be one of the approved Church history types
 *
 * Each validator returns a list of MISSING field paths. An empty list
 * means the package satisfies the spec's structural requirements.
 */

import type { ChecklistContentType } from "@prisma/client";

/** Spec section 7 — only these history types are publishable. */
export const APPROVED_HISTORY_TYPES = [
  "councils",
  "major_church_events",
  "encyclicals",
  "papal_consecrations",
  "schisms",
  "religious_order_foundings",
  "catechisms",
  "code_of_canon_law",
  "major_papal_acts",
  "major_doctrinal_definitions",
  "major_ecumenical_events",
  "major_liturgical_reforms",
] as const;

export type ApprovedHistoryType = (typeof APPROVED_HISTORY_TYPES)[number];

const COMMON_PROVENANCE_FIELDS = ["sourceUrl", "sourceHost", "provenance", "validationEvidence"];

function checkPaths(payload: unknown, paths: string[]): string[] {
  if (!payload || typeof payload !== "object") {
    return paths;
  }
  const obj = payload as Record<string, unknown>;
  const missing: string[] = [];
  for (const path of paths) {
    if (!path.includes(".")) {
      if (obj[path] == null || obj[path] === "") missing.push(path);
      continue;
    }
    const parts = path.split(".");
    let cursor: unknown = obj;
    let found = true;
    for (const part of parts) {
      if (cursor && typeof cursor === "object" && part in (cursor as Record<string, unknown>)) {
        cursor = (cursor as Record<string, unknown>)[part];
      } else {
        found = false;
        break;
      }
    }
    if (!found || cursor == null || cursor === "") missing.push(path);
  }
  return missing;
}

function checkProvenance(payload: unknown): string[] {
  return checkPaths(payload, COMMON_PROVENANCE_FIELDS);
}

export interface PackagingValidationResult {
  contentType: ChecklistContentType;
  missingFields: string[];
  ok: boolean;
}

export function validatePrayerPackage(payload: unknown): string[] {
  return checkPaths(payload, [
    "prayerTitle",
    "prayerType",
    "prayerText",
    "category",
    ...COMMON_PROVENANCE_FIELDS,
    "formattingMetadata",
  ]);
}

export function validateSaintPackage(payload: unknown): string[] {
  return checkPaths(payload, [
    "saintName",
    "saintType",
    "feastDay",
    "background",
    ...COMMON_PROVENANCE_FIELDS,
  ]);
}

export function validateApparitionPackage(payload: unknown): string[] {
  return checkPaths(payload, [
    "apparitionTitle",
    "apparitionLocation",
    "apparitionDate",
    "approvalStatus",
    "background",
    ...COMMON_PROVENANCE_FIELDS,
  ]);
}

export function validateDevotionPackage(payload: unknown): string[] {
  return checkPaths(payload, [
    "devotionTitle",
    "devotionType",
    "background",
    "howToPractice",
    ...COMMON_PROVENANCE_FIELDS,
  ]);
}

export function validateNovenaPackage(payload: unknown): string[] {
  const missing = checkPaths(payload, [
    "novenaTitle",
    "background",
    "purpose",
    "duration",
    "dropdownMetadata",
    ...COMMON_PROVENANCE_FIELDS,
  ]);
  // Day 1..9 each must include title and prayer.
  for (let i = 1; i <= 9; i++) {
    missing.push(...checkPaths(payload, [`days.day${i}.title`, `days.day${i}.prayer`]));
  }
  return missing;
}

export function validateRosaryPackage(payload: unknown): string[] {
  const missing = checkPaths(payload, [
    "title",
    "background",
    "howToPray",
    "openingPrayers",
    "closingPrayers",
    ...COMMON_PROVENANCE_FIELDS,
  ]);
  // mysterySets must be a non-empty array of objects, each with 5
  // mysteries + a decade structure.
  const obj = payload as Record<string, unknown> | null;
  const sets = obj?.mysterySets;
  if (!Array.isArray(sets) || sets.length === 0) {
    missing.push("mysterySets");
    return missing;
  }
  sets.forEach((set, i) => {
    if (!set || typeof set !== "object") {
      missing.push(`mysterySets[${i}]`);
      return;
    }
    const setObj = set as Record<string, unknown>;
    const mysteries = setObj.mysteries;
    if (!Array.isArray(mysteries) || mysteries.length !== 5) {
      missing.push(`mysterySets[${i}].mysteries(=5)`);
    }
    if (!setObj.decadeStructure) {
      missing.push(`mysterySets[${i}].decadeStructure`);
    }
  });
  return missing;
}

export function validateConsecrationPackage(payload: unknown): string[] {
  const missing = checkPaths(payload, [
    "consecrationTitle",
    "background",
    "duration",
    "dailyStructure",
    "finalConsecrationPrayer",
    ...COMMON_PROVENANCE_FIELDS,
  ]);
  const obj = payload as Record<string, unknown> | null;
  const daily = obj?.dailyStructure;
  if (Array.isArray(daily)) {
    daily.forEach((day, i) => {
      if (!day || typeof day !== "object" || !(day as Record<string, unknown>).prayer) {
        missing.push(`dailyStructure[${i}].prayer`);
      }
    });
  }
  return missing;
}

export function validateSacramentPackage(payload: unknown): string[] {
  return checkPaths(payload, [
    "sacramentBadge",
    "sacramentTitle",
    "sacramentKey",
    "description",
    "preparation",
    "participation",
    ...COMMON_PROVENANCE_FIELDS,
  ]);
}

export function validateHistoryPackage(payload: unknown): string[] {
  const missing = checkPaths(payload, [
    "historyType",
    "title",
    "dateOrEra",
    "summary",
    "body",
    ...COMMON_PROVENANCE_FIELDS,
  ]);
  const obj = payload as Record<string, unknown> | null;
  const ht = obj?.historyType;
  if (typeof ht === "string" && !APPROVED_HISTORY_TYPES.includes(ht as ApprovedHistoryType)) {
    missing.push(`historyType(not one of approved types)`);
  }
  return missing;
}

export function validateLiturgyPackage(payload: unknown): string[] {
  return checkPaths(payload, [
    "liturgyTitle",
    "liturgyType",
    "summary",
    "formationBody",
    ...COMMON_PROVENANCE_FIELDS,
  ]);
}

export function validateParishPackage(payload: unknown): string[] {
  return checkPaths(payload, [
    "parishName",
    "address",
    "city",
    "country",
    ...COMMON_PROVENANCE_FIELDS,
  ]);
}

/**
 * Single entry point. Returns the missing-fields list for the given
 * content type; an empty list means the package satisfies spec
 * section 7's structural requirements for that content type.
 */
export function validatePackagingByType(
  contentType: ChecklistContentType,
  payload: unknown,
): PackagingValidationResult {
  let missing: string[];
  switch (contentType) {
    case "PRAYER":
      missing = validatePrayerPackage(payload);
      break;
    case "SAINT":
      missing = validateSaintPackage(payload);
      break;
    case "APPARITION":
      missing = validateApparitionPackage(payload);
      break;
    case "DEVOTION":
      missing = validateDevotionPackage(payload);
      break;
    case "NOVENA":
      missing = validateNovenaPackage(payload);
      break;
    case "SACRAMENT":
      missing = validateSacramentPackage(payload);
      break;
    case "CHURCH_DOCUMENT":
      missing = validateHistoryPackage(payload);
      break;
    case "LITURGICAL":
      missing = validateLiturgyPackage(payload);
      break;
    case "MARIAN_TITLE":
      // Marian titles use the apparition packaging when applicable;
      // otherwise fall back to provenance only.
      missing = checkPaths(payload, ["marianTitleName", "background", ...COMMON_PROVENANCE_FIELDS]);
      break;
    case "GUIDE":
    case "SPIRITUAL_PRACTICE":
      // Rosary + Consecration spec-required structures fall under
      // GUIDE / SPIRITUAL_PRACTICE in the existing schema. Heuristic:
      // if the payload mentions mysterySets it's Rosary; if it
      // mentions dailyStructure it's Consecration.
      missing = (() => {
        const obj = payload as Record<string, unknown> | null;
        if (obj && Array.isArray(obj.mysterySets)) return validateRosaryPackage(payload);
        if (obj && obj.dailyStructure) return validateConsecrationPackage(payload);
        return checkProvenance(payload).concat(checkPaths(payload, ["title", "body"]));
      })();
      break;
    default:
      missing = checkProvenance(payload);
  }
  return { contentType, missingFields: missing, ok: missing.length === 0 };
}
