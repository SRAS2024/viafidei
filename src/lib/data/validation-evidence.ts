/**
 * Validation evidence data access.
 *
 * Backs the admin "Validation evidence" page and the per-package
 * content receipt. ContentValidationEvidence rows live for the
 * lifetime of the package they validate. This helper aggregates
 * them for the admin observability surface.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";

export type ValidationEvidenceRow = {
  id: string;
  packageId: string | null;
  candidateSlug: string | null;
  contentType: string;
  fieldName: string;
  sourceUrl: string;
  sourceHost: string;
  evidenceType: string;
  matchedValue: string | null;
  matchConfidence: number;
  validationDecision: string;
  reason: string | null;
  createdAt: Date;
};

export type ValidationEvidenceSummary = {
  totalRows: number;
  totalPass: number;
  totalFail: number;
  totalInsufficient: number;
  byContentType: Array<{
    contentType: string;
    pass: number;
    fail: number;
    insufficient: number;
  }>;
  recent: ValidationEvidenceRow[];
};

const EMPTY_SUMMARY: ValidationEvidenceSummary = {
  totalRows: 0,
  totalPass: 0,
  totalFail: 0,
  totalInsufficient: 0,
  byContentType: [],
  recent: [],
};

/**
 * Fetch a paginated slice of validation-evidence rows + the rolling
 * pass/fail/insufficient counts per content type for the dashboard
 * header. Resilient to a missing table (returns zeros) so the page
 * renders even when no evidence has been written yet.
 */
export async function getValidationEvidenceSummary(opts: {
  limit?: number;
  contentType?: string | null;
}): Promise<ValidationEvidenceSummary> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  try {
    const client = prisma as unknown as {
      contentValidationEvidence?: {
        findMany: (args: Record<string, unknown>) => Promise<ValidationEvidenceRow[]>;
        count: (args?: Record<string, unknown>) => Promise<number>;
        groupBy: (args: Record<string, unknown>) => Promise<
          Array<{
            contentType: string;
            validationDecision: string;
            _count: { _all: number };
          }>
        >;
      };
    };
    if (!client.contentValidationEvidence) return EMPTY_SUMMARY;

    const where = opts.contentType ? { contentType: opts.contentType } : {};
    const [rows, totalRows, totalPass, totalFail, totalInsufficient, groups] = await Promise.all([
      client.contentValidationEvidence.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      client.contentValidationEvidence.count({ where }),
      client.contentValidationEvidence.count({ where: { ...where, validationDecision: "pass" } }),
      client.contentValidationEvidence.count({ where: { ...where, validationDecision: "fail" } }),
      client.contentValidationEvidence.count({
        where: { ...where, validationDecision: "insufficient_evidence" },
      }),
      client.contentValidationEvidence.groupBy({
        by: ["contentType", "validationDecision"],
        _count: { _all: true },
      }),
    ]);

    const byContentTypeMap = new Map<
      string,
      { pass: number; fail: number; insufficient: number }
    >();
    for (const g of groups) {
      const entry = byContentTypeMap.get(g.contentType) ?? {
        pass: 0,
        fail: 0,
        insufficient: 0,
      };
      if (g.validationDecision === "pass") entry.pass += g._count._all;
      else if (g.validationDecision === "fail") entry.fail += g._count._all;
      else entry.insufficient += g._count._all;
      byContentTypeMap.set(g.contentType, entry);
    }
    const byContentType = [...byContentTypeMap.entries()]
      .map(([contentType, v]) => ({ contentType, ...v }))
      .sort((a, b) => a.contentType.localeCompare(b.contentType));

    return {
      totalRows,
      totalPass,
      totalFail,
      totalInsufficient,
      byContentType,
      recent: rows,
    };
  } catch (e) {
    logger.warn("validation-evidence.summary_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return EMPTY_SUMMARY;
  }
}
