/**
 * Content builder (spec §9). Wraps the existing extractor output
 * (`ExtractorOutput<T>` from `extractors.ts`) and produces the
 * full structured content package the spec asks for:
 *
 *   - package type (the content type)
 *   - normalized title
 *   - normalized slug
 *   - display fields (the user-facing fields)
 *   - body sections (PARAGRAPH / PRAYER / DAY_SECTION / LIST / TABLE)
 *   - dropdown sections (per-type dropdown metadata)
 *   - required fields
 *   - optional fields
 *   - missing fields
 *   - field provenance (from the extractor)
 *   - validation needs (which fields require cross-source verification)
 *   - formatting metadata (line breaks, list styles, ...)
 *   - duplicate keys (slug + title hash) for the publish gate
 *   - rejection reasons
 *   - repair suggestions
 *   - extractor confidence by field
 *   - extractor confidence by package (composite)
 *
 * The content builder is pure — it never mutates the input,
 * never invents missing facts, and is deterministic.
 */

import { createHash } from "node:crypto";

import type { ExtractorOutput } from "./extractors";
import type { FieldProvenance } from "./provenance";

/**
 * Per-content-type required field lists. Mirrors spec §10 — also
 * mirrored in packaging.ts and verifier.ts, kept here as the single
 * source of truth for the content builder layer.
 */
export const REQUIRED_FIELDS: Record<string, string[]> = {
  PRAYER: ["prayerTitle", "prayerType", "prayerText", "category"],
  SAINT: ["saintName", "saintType", "feastDay", "background"],
  APPARITION: [
    "apparitionTitle",
    "apparitionLocation",
    "apparitionDate",
    "approvalStatus",
    "background",
  ],
  NOVENA: ["novenaTitle", "background", "purpose", "duration", "dropdownMetadata"],
  ROSARY: ["title", "background", "howToPray", "openingPrayers", "closingPrayers", "mysterySets"],
  DEVOTION: ["devotionTitle", "devotionType", "background", "howToPractice"],
  CONSECRATION: [
    "consecrationTitle",
    "background",
    "duration",
    "dailyStructure",
    "finalConsecrationPrayer",
  ],
  SACRAMENT: [
    "sacramentBadge",
    "sacramentTitle",
    "sacramentKey",
    "description",
    "preparation",
    "participation",
  ],
  CHURCH_DOCUMENT: ["historyType", "title", "dateOrEra", "summary", "body"],
  LITURGICAL: ["liturgyTitle", "liturgyType", "summary", "formationBody"],
  PARISH: ["parishName", "address", "city", "country"],
  POPE: ["popeName", "papacyStart"],
  DOCTOR: ["doctorName"],
  RITE: ["riteName"],
};

/**
 * Fields the verifier must cross-check before publishing. Mirrors
 * SENSITIVE_FIELDS in verifier.ts.
 */
const VALIDATION_NEEDS: Record<string, string[]> = {
  SAINT: ["feastDay", "feastMonth", "feastDayNumber"],
  APPARITION: ["approvalStatus", "apparitionDate"],
  CHURCH_DOCUMENT: ["dateOrEra"],
  SACRAMENT: ["sacramentKey"],
  NOVENA: ["duration"],
  ROSARY: ["mysterySets"],
};

/**
 * Optional fields the extractor may normalise but the publish gate
 * does not require.
 */
const OPTIONAL_FIELDS: Record<string, string[]> = {
  PRAYER: ["liturgicalSeason", "patron", "audience"],
  SAINT: ["birthDate", "deathDate", "birthplace", "patronage", "canonizationYear"],
  APPARITION: ["seers", "approvalCitation"],
  NOVENA: ["intentions", "litanicalContext"],
  ROSARY: ["history", "indulgences"],
  DEVOTION: ["origin", "audience"],
  CONSECRATION: ["intentions", "approvalCitation"],
  SACRAMENT: ["minister", "matter", "form"],
  CHURCH_DOCUMENT: ["authority", "promulgationDate"],
  LITURGICAL: ["liturgicalSeason", "color"],
  PARISH: ["website", "diocese", "region"],
  POPE: ["papacyEnd", "birthName", "background"],
  DOCTOR: ["doctorTitle", "feastDay", "background"],
  RITE: ["history", "background", "riteKey"],
};

export interface ContentPackage {
  packageType: string;
  normalizedTitle: string;
  normalizedSlug: string;
  displayFields: Record<string, unknown>;
  bodySections: Array<{ type: string; text: string; order: number }>;
  dropdownSections: Record<string, unknown>;
  requiredFields: string[];
  optionalFields: string[];
  missingFields: string[];
  fieldProvenance: FieldProvenance[];
  validationNeeds: string[];
  formattingMetadata: Record<string, unknown>;
  duplicateKeys: { slug: string; titleHash: string };
  rejectionReasons: string[];
  repairSuggestions: string[];
  /** Per-field confidence 0..1 (from extractor provenance). */
  confidenceByField: Record<string, number>;
  /** Composite confidence for the whole package, 0..1. */
  confidenceByPackage: number;
}

export interface BuildPackageInput<T extends Record<string, unknown>> {
  contentType: string;
  extractor: ExtractorOutput<T>;
  /** Optional title override. */
  title?: string;
}

/**
 * Build a structured ContentPackage from an extractor output. The
 * caller passes the raw ExtractorOutput; we normalise + enrich
 * without inventing missing facts (spec §9: extractors NEVER invent
 * facts).
 */
export function buildContentPackage<T extends Record<string, unknown>>(
  input: BuildPackageInput<T>,
): ContentPackage {
  const fields = input.extractor.fields as Record<string, unknown>;
  const required = REQUIRED_FIELDS[input.contentType] ?? [];
  const optional = OPTIONAL_FIELDS[input.contentType] ?? [];
  const validation = VALIDATION_NEEDS[input.contentType] ?? [];

  const normalizedTitle = normalize(input.title ?? extractTitle(fields));
  const normalizedSlug = slugify(normalizedTitle);

  // Confidence per field (from provenance), capped to [0,1].
  const confidenceByField: Record<string, number> = {};
  for (const p of input.extractor.sourceEvidence) {
    confidenceByField[p.fieldName] = Math.max(0, Math.min(1, p.confidence));
  }

  // Package-level confidence: weighted average of per-field
  // confidences with a penalty for each missing required field.
  const fieldCount = Object.keys(confidenceByField).length;
  const avgConfidence =
    fieldCount === 0
      ? input.extractor.confidenceScore
      : Object.values(confidenceByField).reduce((a, b) => a + b, 0) / fieldCount;
  const missingPenalty = input.extractor.missingFields.length * 0.1;
  const confidenceByPackage = Math.max(0, Math.min(1, avgConfidence - missingPenalty));

  // Repair suggestions per missing required field.
  const repairSuggestions = input.extractor.missingFields.map((f) =>
    suggestRepair(input.contentType, f),
  );

  // Display fields = the required + optional fields that are populated.
  const displayFields: Record<string, unknown> = {};
  for (const f of [...required, ...optional]) {
    if (fields[f] !== undefined && fields[f] !== null && fields[f] !== "") {
      displayFields[f] = fields[f];
    }
  }

  // Body sections — split prayer / day-section / paragraph / list
  // from the formatted text the extractor produced (if any).
  const bodySections = extractBodySections(fields);

  // Dropdown sections — per-content-type metadata that the public UI
  // renders as a dropdown.
  const dropdownSections = (fields.dropdownMetadata as Record<string, unknown> | undefined) ?? {};

  // Duplicate keys — slug + title hash for the publish-gate
  // duplicate check.
  const titleHash = createHash("sha1").update(normalizedTitle).digest("hex");

  const rejectionReasons = input.extractor.fatalReasons;

  return {
    packageType: input.contentType,
    normalizedTitle,
    normalizedSlug,
    displayFields,
    bodySections,
    dropdownSections,
    requiredFields: required,
    optionalFields: optional,
    missingFields: input.extractor.missingFields,
    fieldProvenance: input.extractor.sourceEvidence,
    validationNeeds: validation,
    formattingMetadata: input.extractor.formatting,
    duplicateKeys: { slug: normalizedSlug, titleHash },
    rejectionReasons,
    repairSuggestions,
    confidenceByField,
    confidenceByPackage,
  };
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function extractTitle(fields: Record<string, unknown>): string {
  for (const key of [
    "prayerTitle",
    "saintName",
    "apparitionTitle",
    "novenaTitle",
    "devotionTitle",
    "consecrationTitle",
    "sacramentTitle",
    "title",
    "liturgyTitle",
    "parishName",
  ]) {
    const v = fields[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "Untitled";
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function extractBodySections(
  fields: Record<string, unknown>,
): Array<{ type: string; text: string; order: number }> {
  const sections: Array<{ type: string; text: string; order: number }> = [];
  let order = 0;
  const candidates: Array<{ type: string; key: string }> = [
    { type: "PARAGRAPH", key: "background" },
    { type: "PARAGRAPH", key: "biography" },
    { type: "PARAGRAPH", key: "summary" },
    { type: "PARAGRAPH", key: "description" },
    { type: "PARAGRAPH", key: "body" },
    { type: "PARAGRAPH", key: "formationBody" },
    { type: "PRAYER", key: "prayerText" },
    { type: "PRAYER", key: "finalConsecrationPrayer" },
    { type: "INSTRUCTIONS", key: "howToPray" },
    { type: "INSTRUCTIONS", key: "howToPractice" },
  ];
  for (const c of candidates) {
    const v = fields[c.key];
    if (typeof v === "string" && v.length > 0) {
      sections.push({ type: c.type, text: v, order: order++ });
    }
  }
  // Novena day sections — special case
  const days = fields.days as Record<string, { title?: string; prayer?: string }> | undefined;
  if (days) {
    for (let i = 1; i <= 9; i++) {
      const day = days[`day${i}`];
      if (day?.prayer) {
        sections.push({
          type: "DAY_SECTION",
          text: `Day ${i}: ${day.title ?? ""}\n${day.prayer}`.trim(),
          order: order++,
        });
      }
    }
  }
  return sections;
}

function suggestRepair(contentType: string, missingField: string): string {
  const map: Record<string, string> = {
    prayerText: "Re-fetch the prayer page or try an approved validation source like Vatican.va.",
    feastDay: "Cross-reference saint's feast day with USCCB or Vatican calendar.",
    approvalStatus: "Verify with Vatican apparition approval registry.",
    sourceUrl: "Re-run the source-read stage; sourceUrl must be present on every package.",
    body: "Re-fetch the source page; the structured reader should yield a body.",
    mysterySets: "Source must declare all five mysteries for each Rosary set.",
  };
  return (
    map[missingField] ??
    `Missing ${missingField} on ${contentType}: try a higher-authority validation source or repair extractor.`
  );
}
