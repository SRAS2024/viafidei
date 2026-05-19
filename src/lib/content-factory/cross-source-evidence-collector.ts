/**
 * Cross-source evidence collector.
 *
 * Sits between the builder and `validateCrossSource()`. The collector
 * gathers the evidence rows the validator decides on. It runs inside
 * the same `content_build` worker tick (spec §17 — "fold evidence
 * validation into content_build") so a single queue stage covers
 * the whole factory pipeline.
 *
 * Design notes:
 *
 *  - The validators are *approved* sources for the package's content
 *    type — sources with `role` ∈ {primary_content_source,
 *    validation_source} that carry the matching `canIngest*` purpose
 *    flag. The collector takes the list of validator candidates as
 *    input so the factory can swap in fixtures during tests.
 *
 *  - For each required field on the package, the collector looks for
 *    a validator document whose normalised text contains the
 *    package's field value. The match is exact-text by default; a
 *    couple of fields (feastDay, approvalStatus, dateOrEra,
 *    sacramentKey, sacramentGroup) get a normalisation pass so a
 *    "January 28" and a "Jan 28" agree.
 *
 *  - The collector is *pure*: it does no HTTP itself. A
 *    `validatorDocumentLoader` is passed in so the queue layer can
 *    plug in a real fetch + cache, and the unit tests can plug in an
 *    in-memory map. This keeps the layer testable and keeps the
 *    factory orchestrator free of side effects beyond Prisma writes.
 *
 *  - Deterministic-rule fields (e.g. `sacramentGroup`, `slug`,
 *    `language`) get an `evidenceType: "deterministic_rule"` row
 *    automatically. Approved enrichment fields produced by the
 *    enrich pass get `evidenceType: "approved_enrichment"`.
 */

import { createHash } from "node:crypto";
import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import type { ContentPackage } from "./types";
import {
  CROSS_SOURCE_RULES,
  type CrossSourceContentType,
  type EvidenceRecord,
  type EvidenceType,
} from "./cross-source-validation";

/**
 * One validator the collector can query for a single package. The
 * factory passes the validator's source URL + fetched body, or
 * supplies a `validatorDocumentLoader` that resolves the same on
 * demand.
 */
export type ValidatorCandidate = {
  sourceUrl: string;
  sourceHost: string;
  /** Cleaned plain-text body of the validator document. */
  body?: string;
  /** Optional headings the validator document exposes. */
  headings?: ReadonlyArray<string>;
  /** Optional metadata pairs the validator document exposes. */
  metadata?: Record<string, string | undefined>;
};

export type ValidatorDocumentLoader = (
  validatorSourceUrl: string,
) => Promise<{ body?: string; headings?: ReadonlyArray<string> } | null>;

export type CollectEvidenceInput = {
  pkg: ContentPackage;
  validators: ReadonlyArray<ValidatorCandidate>;
  /** Optional loader for validators that did not ship body inline. */
  loader?: ValidatorDocumentLoader;
  /**
   * Fields that were filled by a deterministic internal rule. Each
   * gets an `evidenceType: "deterministic_rule"` row with confidence
   * 1.0. Defaults to ["slug", "language"] when omitted.
   */
  deterministicFields?: ReadonlyArray<string>;
  /**
   * Fields the enrich pass filled from approved enrichment sources.
   * Each gets an `evidenceType: "approved_enrichment"` row.
   */
  enrichedFields?: ReadonlyArray<string>;
};

export type CollectedEvidence = {
  evidence: EvidenceRecord[];
  totalValidatorsQueried: number;
};

const DEFAULT_DETERMINISTIC_FIELDS: ReadonlyArray<string> = [
  "slug",
  "language",
  "sacramentGroup", // mapped from sacramentKey by sacrament-normalize
];

/**
 * Look up validators for a given content type from the database.
 * Returns only sources whose role permits validation and whose
 * `canIngest*` purpose flag matches.
 */
export async function findApprovedValidators(
  contentType: string,
  options: { limit?: number; excludeHost?: string | null } = {},
): Promise<ValidatorCandidate[]> {
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 20);
  const purposeFlag = purposeFlagForContentType(contentType);
  if (!purposeFlag) return [];
  try {
    const sources = (await prisma.ingestionSource.findMany({
      where: {
        isActive: true,
        role: { in: ["primary_content_source", "validation_source"] },
        ...{ [purposeFlag]: true },
        ...(options.excludeHost ? { host: { not: options.excludeHost } } : {}),
      },
      orderBy: [{ role: "asc" }, { tier: "asc" }],
      take: limit,
    })) as Array<{ host: string; baseUrl: string }>;
    return sources.map((s) => ({
      sourceUrl: s.baseUrl,
      sourceHost: s.host,
    }));
  } catch (e) {
    logger.warn("cross-source-collector.find_validators_failed", {
      contentType,
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

function purposeFlagForContentType(contentType: string): string | null {
  switch (contentType) {
    case "Prayer":
      return "canIngestPrayers";
    case "Saint":
      return "canIngestSaints";
    case "MarianApparition":
      return "canIngestApparitions";
    case "Parish":
      return "canIngestParishes";
    case "Devotion":
      return "canIngestDevotions";
    case "Novena":
      return "canIngestNovenas";
    case "Sacrament":
      return "canIngestSacraments";
    case "Rosary":
      return "canIngestRosaryGuides";
    case "Consecration":
      return "canIngestConsecrations";
    case "SpiritualGuidance":
      return "canIngestSpiritualGuides";
    case "Liturgy":
      return "canIngestLiturgy";
    case "History":
      return "canIngestHistory";
    default:
      return null;
  }
}

/** Stable, case/whitespace-insensitive normaliser for body matching. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‐-―−]/g, "-") // em/en dashes → hyphen
    .replace(/[‘’“”]/g, "") // quotes → ""
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

/**
 * Parse a feast-day string like "January 28", "Jan 28", "28 January",
 * "01-28" into a stable {month, day} tuple. Returns null when the
 * input does not look like a feast date.
 */
function parseFeastDay(value: string): { month: number; day: number } | null {
  const trimmed = value.trim().toLowerCase();
  const m1 = trimmed.match(/^([a-z]+)\s+(\d{1,2})\b/);
  if (m1 && MONTHS[m1[1]]) return { month: MONTHS[m1[1]], day: parseInt(m1[2], 10) };
  const m2 = trimmed.match(/^(\d{1,2})\s+([a-z]+)\b/);
  if (m2 && MONTHS[m2[2]]) return { month: MONTHS[m2[2]], day: parseInt(m2[1], 10) };
  const m3 = trimmed.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (m3) return { month: parseInt(m3[1], 10), day: parseInt(m3[2], 10) };
  return null;
}

/**
 * Decide which EvidenceType to use for a given content-type / field
 * pair. The mapping comes from the spec's evidence-types list.
 */
function evidenceTypeFor(contentType: string, fieldName: string): EvidenceType {
  if (fieldName === "title") return "title_match";
  if (fieldName === "prayerText") return "prayer_text_match";
  if (fieldName === "feastDay") return "feast_day_match";
  if (fieldName === "patronage") return "patronage_match";
  if (fieldName === "approvalStatus") return "apparition_approval_status_match";
  if (fieldName === "scriptureReference") return "scripture_reference_match";
  if (fieldName === "dateOrEra") return "history_date_match";
  if (fieldName === "sacramentKey" || fieldName === "sacramentGroup")
    return "sacrament_identity_match";
  if (contentType === "Parish" && (fieldName === "city" || fieldName === "country"))
    return "parish_identity_match";
  return "exact_text_match";
}

function valueOnPackage(pkg: ContentPackage, fieldName: string): string | null {
  if (fieldName === "title") return pkg.title;
  if (fieldName === "slug") return pkg.slug;
  if (fieldName === "language") return pkg.language ?? null;
  const payload = pkg.payload as Record<string, unknown>;
  const raw = payload[fieldName];
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return String(raw);
  if (Array.isArray(raw)) return raw.map((x) => String(x)).join(" ");
  return null;
}

function checksumFor(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function matchesValidator(
  fieldValue: string,
  fieldName: string,
  validator: ValidatorCandidate,
): { ok: boolean; confidence: number; matched?: string } {
  const haystack = [validator.body ?? "", (validator.headings ?? []).join(" ")]
    .filter(Boolean)
    .join(" ");
  if (!haystack) return { ok: false, confidence: 0 };

  // Feast day match — tolerant comparison.
  if (fieldName === "feastDay") {
    const pkgDate = parseFeastDay(fieldValue);
    if (!pkgDate) return { ok: false, confidence: 0 };
    // Scan the haystack for any feast-date-shaped substring that
    // matches month + day.
    const lowered = haystack.toLowerCase();
    const monthRegex =
      /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})/g;
    let m: RegExpExecArray | null;
    while ((m = monthRegex.exec(lowered))) {
      const test = parseFeastDay(`${m[1]} ${m[2]}`);
      if (test && test.month === pkgDate.month && test.day === pkgDate.day)
        return { ok: true, confidence: 0.95, matched: `${m[1]} ${m[2]}` };
    }
    return { ok: false, confidence: 0 };
  }

  // Default: substring-of-normalised-text.
  const needle = normalise(fieldValue);
  if (!needle) return { ok: false, confidence: 0 };
  const norm = normalise(haystack);
  if (norm.includes(needle)) {
    // Confidence drops a touch on short needles (likely false positives).
    const conf = needle.length < 6 ? 0.65 : 0.9;
    return { ok: true, confidence: conf, matched: fieldValue };
  }
  return { ok: false, confidence: 0 };
}

/**
 * Run the collector on a built package and return the evidence
 * record list. Validator documents that arrive without a `body` get
 * resolved via the optional `loader` callback (the queue layer
 * passes a cached HTTP fetcher).
 */
export async function collectCrossSourceEvidence(
  input: CollectEvidenceInput,
): Promise<CollectedEvidence> {
  const evidence: EvidenceRecord[] = [];
  const contentType = input.pkg.contentType as CrossSourceContentType;
  const requiredFields = CROSS_SOURCE_RULES[contentType] ?? [];

  // Hydrate validators with body content when missing.
  const hydrated: ValidatorCandidate[] = [];
  for (const v of input.validators) {
    if (v.body !== undefined) {
      hydrated.push(v);
      continue;
    }
    if (input.loader) {
      try {
        const doc = await input.loader(v.sourceUrl);
        hydrated.push({ ...v, body: doc?.body ?? "", headings: doc?.headings });
      } catch (e) {
        logger.warn("cross-source-collector.loader_failed", {
          url: v.sourceUrl,
          error: e instanceof Error ? e.message : String(e),
        });
        hydrated.push({ ...v, body: "" });
      }
    } else {
      hydrated.push({ ...v, body: "" });
    }
  }

  // Pass 1: deterministic + enrichment fields. These are always
  // sufficient on their own per the spec rule list.
  const deterministicFields = input.deterministicFields ?? DEFAULT_DETERMINISTIC_FIELDS;
  for (const field of deterministicFields) {
    const value = valueOnPackage(input.pkg, field);
    if (value === null) continue;
    evidence.push({
      fieldName: field,
      evidenceType: "deterministic_rule",
      sourceUrl: `internal://deterministic/${field}`,
      sourceHost: "internal",
      validationDecision: "pass",
      matchConfidence: 1.0,
      matchedValue: value,
      evidenceChecksum: checksumFor(value),
      reason: "Filled by a deterministic internal rule",
    });
  }
  for (const field of input.enrichedFields ?? []) {
    const value = valueOnPackage(input.pkg, field);
    if (value === null) continue;
    evidence.push({
      fieldName: field,
      evidenceType: "approved_enrichment",
      sourceUrl: `internal://enrichment/${field}`,
      sourceHost: "internal",
      validationDecision: "pass",
      matchConfidence: 1.0,
      matchedValue: value,
      evidenceChecksum: checksumFor(value),
      reason: "Filled by an approved enrichment source",
    });
  }

  // Pass 2: required-field matching against each validator candidate.
  for (const field of requiredFields) {
    const value = valueOnPackage(input.pkg, field);
    if (value === null || value.trim() === "") continue;
    let matched = false;
    for (const validator of hydrated) {
      const result = matchesValidator(value, field, validator);
      if (result.ok) {
        evidence.push({
          fieldName: field,
          evidenceType: evidenceTypeFor(contentType, field),
          sourceUrl: validator.sourceUrl,
          sourceHost: validator.sourceHost,
          validationDecision: "pass",
          matchConfidence: result.confidence,
          matchedValue: result.matched ?? value,
          evidenceChecksum: checksumFor(value),
        });
        matched = true;
        break; // First matching validator is enough.
      }
    }
    if (!matched && hydrated.length > 0) {
      evidence.push({
        fieldName: field,
        evidenceType: evidenceTypeFor(contentType, field),
        sourceUrl: hydrated[0].sourceUrl,
        sourceHost: hydrated[0].sourceHost,
        validationDecision: "insufficient_evidence",
        matchConfidence: 0,
        matchedValue: null,
        evidenceChecksum: null,
        reason: `No approved validator matched ${field}`,
      });
    }
  }

  return { evidence, totalValidatorsQueried: hydrated.length };
}

/**
 * Persist a batch of collected evidence rows to
 * ContentValidationEvidence. Used by the worker after the
 * collector + validator have decided pass/fail so the admin
 * validation-evidence page can replay the decision.
 */
export async function persistEvidenceBatch(
  rows: ReadonlyArray<EvidenceRecord>,
  context: {
    packageId?: string | null;
    candidateSlug?: string | null;
    contentType: string;
    buildLogId?: string | null;
  },
): Promise<{ written: number; errors: number }> {
  if (rows.length === 0) return { written: 0, errors: 0 };
  const client = prisma as unknown as {
    contentValidationEvidence?: {
      createMany: (args: { data: unknown[] }) => Promise<{ count: number }>;
    };
  };
  if (!client.contentValidationEvidence) return { written: 0, errors: 0 };
  try {
    const data = rows.map((r) => ({
      packageId: context.packageId ?? null,
      candidateSlug: context.candidateSlug ?? null,
      contentType: context.contentType,
      fieldName: r.fieldName,
      sourceUrl: r.sourceUrl,
      sourceHost: r.sourceHost,
      evidenceType: r.evidenceType,
      evidenceChecksum: r.evidenceChecksum ?? null,
      matchedValue: r.matchedValue ?? null,
      matchConfidence: r.matchConfidence,
      validationDecision: r.validationDecision,
      reason: r.reason ?? null,
      buildLogId: context.buildLogId ?? null,
    }));
    const result = await client.contentValidationEvidence.createMany({ data });
    return { written: result.count, errors: 0 };
  } catch (e) {
    logger.warn("cross-source-collector.persist_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return { written: 0, errors: 1 };
  }
}
