/**
 * Field-level provenance (spec §10). Every required field on a content
 * package has a record showing where it came from: source URL, host,
 * extracted snippet, extraction method, confidence, timestamp, and
 * the source-page checksum. Without provenance a field cannot be
 * published — except deterministic internal rules (eg. the seven
 * sacraments list, the five-mystery Rosary structure).
 */

export type ExtractionMethod =
  | "URL_PATTERN"
  | "TITLE_REGEX"
  | "HEADING_MATCH"
  | "BODY_REGEX"
  | "STRUCTURED_DATA"
  | "INTERNAL_RULE"
  | "AI_EXTRACTION"
  | "OPERATOR";

export interface FieldProvenance {
  fieldName: string;
  sourceUrl: string;
  sourceHost: string;
  snippet: string;
  extractionMethod: ExtractionMethod;
  confidence: number;
  timestamp: string;
  checksum?: string;
  isDeterministicInternalRule?: boolean;
}

/** Internal rules — fields produced by code rather than scraped from a source. */
export const DETERMINISTIC_INTERNAL_FIELDS: ReadonlySet<string> = new Set([
  "rosary.decadeStructure",
  "rosary.mysteryCount",
  "sacrament.sevenSacramentList",
  "novena.requiredDayCount",
  "contentTypeMapping",
  "formattingMetadata",
]);

export function makeProvenance(input: {
  fieldName: string;
  sourceUrl: string;
  sourceHost: string;
  snippet: string;
  method: ExtractionMethod;
  confidence: number;
  checksum?: string;
}): FieldProvenance {
  return {
    fieldName: input.fieldName,
    sourceUrl: input.sourceUrl,
    sourceHost: input.sourceHost,
    snippet: input.snippet.slice(0, 240),
    extractionMethod: input.method,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    timestamp: new Date().toISOString(),
    checksum: input.checksum,
  };
}

export function makeInternalRuleProvenance(fieldName: string): FieldProvenance {
  return {
    fieldName,
    sourceUrl: "internal://admin-worker",
    sourceHost: "admin-worker",
    snippet: `Field is fixed by deterministic internal rule.`,
    extractionMethod: "INTERNAL_RULE",
    confidence: 1,
    timestamp: new Date().toISOString(),
    isDeterministicInternalRule: true,
  };
}

/**
 * Returns the list of required fields that are missing a provenance
 * record. Internal-rule fields are exempt — they're allowed without
 * provenance because their value is fixed in code.
 */
export function missingProvenance(
  requiredFields: ReadonlyArray<string>,
  provided: ReadonlyArray<FieldProvenance>,
): string[] {
  const providedNames = new Set(provided.map((p) => p.fieldName));
  return requiredFields.filter((f) => {
    if (DETERMINISTIC_INTERNAL_FIELDS.has(f)) return false;
    return !providedNames.has(f);
  });
}

/**
 * True when every required field has provenance (or is exempt). Used
 * by the publish gate (spec §12) to block publishing of packages that
 * lack field-level evidence.
 */
export function hasFullProvenance(
  requiredFields: ReadonlyArray<string>,
  provided: ReadonlyArray<FieldProvenance>,
): boolean {
  return missingProvenance(requiredFields, provided).length === 0;
}
