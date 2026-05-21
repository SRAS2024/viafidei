/**
 * Raw row audit.
 *
 * Classifies every catalog row into exactly one bucket so the admin
 * can see — without guessing — which existing rows are already valid
 * public packages, which can be converted through the factory, and
 * which are unrecoverable.
 *
 * This module is strictly read-only: it never publishes or deletes a
 * row. Conversion goes through a `content_revalidate` job; deletion
 * goes through strict cleanup. Both apply the real QA rules.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";

export type RawRowCategory =
  | "already_valid_public"
  | "blocked_by_public_gate"
  | "missing_source_evidence"
  | "convertible_through_factory"
  | "invalid_and_deletable";

export type RawRowAuditRow = {
  contentType: string;
  total: number;
  alreadyValidPublic: number;
  blockedByPublicGate: number;
  missingSourceEvidence: number;
  convertibleThroughFactory: number;
  invalidAndDeletable: number;
  /** True when the model has more rows than the per-model scan limit. */
  capped: boolean;
};

export type RawRowAuditReport = {
  generatedAt: Date;
  rows: RawRowAuditRow[];
  totalRows: number;
  /** Rows that are NOT already valid public packages. */
  totalRawRows: number;
  totalConvertible: number;
  /** Non-empty dashboard warning when raw rows exist. */
  warning: string;
  errors: string[];
};

/** Distinct public content models (one row per model — no double counting). */
const AUDIT_MODELS: ReadonlyArray<{ contentType: string; model: string }> = [
  { contentType: "Prayer", model: "prayer" },
  { contentType: "Saint", model: "saint" },
  { contentType: "MarianApparition", model: "marianApparition" },
  { contentType: "Parish", model: "parish" },
  { contentType: "Devotion", model: "devotion" },
  { contentType: "SpiritualLifeGuide", model: "spiritualLifeGuide" },
  { contentType: "LiturgyEntry", model: "liturgyEntry" },
];

const PER_MODEL_LIMIT = 5000;

export type CatalogRowFields = {
  status: string;
  publicRenderReady: boolean;
  isThresholdEligible: boolean;
  archivedAt: Date | null;
  sourceUrl: string | null;
  sourceHost: string | null;
};

/**
 * Classify a single catalog row. Priority-ordered so every row lands
 * in exactly one bucket.
 */
export function classifyRawRow(row: CatalogRowFields): RawRowCategory {
  // 1. Already a valid public package — passes the strict public gate.
  if (
    row.status === "PUBLISHED" &&
    row.publicRenderReady &&
    row.isThresholdEligible &&
    row.archivedAt === null
  ) {
    return "already_valid_public";
  }
  // 2. Archived — invalid and safe to hard-delete via strict cleanup.
  if (row.archivedAt !== null) return "invalid_and_deletable";
  // 3. No source URL / host — cannot be re-validated or trusted.
  if (!row.sourceUrl || !row.sourceHost) return "missing_source_evidence";
  // 4. Published but the strict public gate is failing it.
  if (row.status === "PUBLISHED") return "blocked_by_public_gate";
  // 5. Has source evidence and is not archived — can be rebuilt
  //    through the factory (content_revalidate) and re-gated.
  return "convertible_through_factory";
}

export async function auditRawRows(): Promise<RawRowAuditReport> {
  const generatedAt = new Date();
  const errors: string[] = [];
  const rows: RawRowAuditRow[] = [];
  const client = prisma as unknown as Record<
    string,
    { findMany: (a: unknown) => Promise<CatalogRowFields[]> }
  >;

  for (const { contentType, model } of AUDIT_MODELS) {
    const delegate = client[model];
    if (!delegate) {
      errors.push(`no prisma model ${model}`);
      continue;
    }
    try {
      const catalogRows = await delegate.findMany({
        select: {
          status: true,
          publicRenderReady: true,
          isThresholdEligible: true,
          archivedAt: true,
          sourceUrl: true,
          sourceHost: true,
        },
        take: PER_MODEL_LIMIT + 1,
      });
      const capped = catalogRows.length > PER_MODEL_LIMIT;
      const slice = capped ? catalogRows.slice(0, PER_MODEL_LIMIT) : catalogRows;
      const counts: Record<RawRowCategory, number> = {
        already_valid_public: 0,
        blocked_by_public_gate: 0,
        missing_source_evidence: 0,
        convertible_through_factory: 0,
        invalid_and_deletable: 0,
      };
      for (const r of slice) counts[classifyRawRow(r)] += 1;
      rows.push({
        contentType,
        total: slice.length,
        alreadyValidPublic: counts.already_valid_public,
        blockedByPublicGate: counts.blocked_by_public_gate,
        missingSourceEvidence: counts.missing_source_evidence,
        convertibleThroughFactory: counts.convertible_through_factory,
        invalidAndDeletable: counts.invalid_and_deletable,
        capped,
      });
    } catch (e) {
      errors.push(`${contentType}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const totalRows = rows.reduce((a, r) => a + r.total, 0);
  const totalValidPublic = rows.reduce((a, r) => a + r.alreadyValidPublic, 0);
  const totalRawRows = totalRows - totalValidPublic;
  const totalConvertible = rows.reduce((a, r) => a + r.convertibleThroughFactory, 0);
  const warning =
    totalRawRows > 0 ? "Existing raw rows require factory conversion or strict deletion." : "";

  logger.info("raw-row-audit.completed", { totalRows, totalRawRows, totalConvertible });
  return { generatedAt, rows, totalRows, totalRawRows, totalConvertible, warning, errors };
}
