/**
 * Validation evidence data access.
 *
 * Backs the admin cross-source validation dashboard and the
 * per-package content receipt. ContentValidationEvidence rows live
 * for the lifetime of the package they validate. This helper
 * aggregates them for the admin observability surface:
 *
 *   - evidence created / passed / failed / insufficient
 *   - evidence by content type, by source host, by field, by source role
 *   - most common insufficient-evidence reasons
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

export type EvidenceDecisionCounts = {
  pass: number;
  fail: number;
  insufficient: number;
};

export type ValidationEvidenceSummary = {
  totalRows: number;
  totalPass: number;
  totalFail: number;
  totalInsufficient: number;
  byContentType: Array<{ contentType: string } & EvidenceDecisionCounts>;
  bySourceHost: Array<{ host: string } & EvidenceDecisionCounts>;
  byField: Array<{ field: string } & EvidenceDecisionCounts>;
  bySourceRole: Array<{ role: string } & EvidenceDecisionCounts>;
  topInsufficientReasons: Array<{ reason: string; count: number }>;
  recent: ValidationEvidenceRow[];
};

const EMPTY_SUMMARY: ValidationEvidenceSummary = {
  totalRows: 0,
  totalPass: 0,
  totalFail: 0,
  totalInsufficient: 0,
  byContentType: [],
  bySourceHost: [],
  byField: [],
  bySourceRole: [],
  topInsufficientReasons: [],
  recent: [],
};

type DecisionGroup = Record<string, unknown> & {
  validationDecision: string;
  _count: { _all: number };
};

/** Fold a `groupBy([key, validationDecision])` result into per-key counts. */
function accumulate(
  groups: DecisionGroup[],
  keyField: string,
): Map<string, EvidenceDecisionCounts> {
  const map = new Map<string, EvidenceDecisionCounts>();
  for (const g of groups) {
    const key = (g[keyField] as string | null) ?? "(none)";
    const entry = map.get(key) ?? { pass: 0, fail: 0, insufficient: 0 };
    if (g.validationDecision === "pass") entry.pass += g._count._all;
    else if (g.validationDecision === "fail") entry.fail += g._count._all;
    else entry.insufficient += g._count._all;
    map.set(key, entry);
  }
  return map;
}

function sortedByVolume<T extends EvidenceDecisionCounts>(rows: T[], limit?: number): T[] {
  const sorted = [...rows].sort(
    (a, b) => b.pass + b.fail + b.insufficient - (a.pass + a.fail + a.insufficient),
  );
  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Fetch a paginated slice of validation-evidence rows + the rolling
 * pass / fail / insufficient counts grouped by content type, source
 * host, field and source role, plus the most common insufficient-
 * evidence reasons. Resilient to a missing table (returns zeros).
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
        groupBy: (args: Record<string, unknown>) => Promise<DecisionGroup[]>;
      };
    };
    if (!client.contentValidationEvidence) return EMPTY_SUMMARY;
    const evidence = client.contentValidationEvidence;

    const where = opts.contentType ? { contentType: opts.contentType } : {};
    const [
      rows,
      totalRows,
      totalPass,
      totalFail,
      totalInsufficient,
      byContentTypeGroups,
      bySourceHostGroups,
      byFieldGroups,
      insufficientReasonGroups,
    ] = await Promise.all([
      evidence.findMany({ where, orderBy: { createdAt: "desc" }, take: limit }),
      evidence.count({ where }),
      evidence.count({ where: { ...where, validationDecision: "pass" } }),
      evidence.count({ where: { ...where, validationDecision: "fail" } }),
      evidence.count({ where: { ...where, validationDecision: "insufficient_evidence" } }),
      evidence.groupBy({
        by: ["contentType", "validationDecision"],
        where,
        _count: { _all: true },
      }),
      evidence.groupBy({
        by: ["sourceHost", "validationDecision"],
        where,
        _count: { _all: true },
      }),
      evidence.groupBy({
        by: ["fieldName", "validationDecision"],
        where,
        _count: { _all: true },
      }),
      evidence.groupBy({
        by: ["reason"],
        where: { ...where, validationDecision: "insufficient_evidence" },
        _count: { _all: true },
      }),
    ]);

    // Source-host → role map, so evidence can be grouped by source role.
    const hostRoleMap = new Map<string, string>();
    try {
      const sources = await prisma.ingestionSource.findMany({ select: { host: true, role: true } });
      for (const s of sources) hostRoleMap.set(s.host, s.role ?? "unknown");
    } catch (e) {
      logger.warn("validation-evidence.host_role_map_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const byContentType = sortedByVolume(
      [...accumulate(byContentTypeGroups, "contentType").entries()].map(([contentType, v]) => ({
        contentType,
        ...v,
      })),
    );
    const byHostMap = accumulate(bySourceHostGroups, "sourceHost");
    const bySourceHost = sortedByVolume(
      [...byHostMap.entries()].map(([host, v]) => ({ host, ...v })),
      15,
    );
    const byField = sortedByVolume(
      [...accumulate(byFieldGroups, "fieldName").entries()].map(([field, v]) => ({
        field,
        ...v,
      })),
      15,
    );

    // Roll the per-host counts up into per-role counts.
    const roleMap = new Map<string, EvidenceDecisionCounts>();
    for (const [host, counts] of byHostMap.entries()) {
      const role = hostRoleMap.get(host) ?? "unknown";
      const entry = roleMap.get(role) ?? { pass: 0, fail: 0, insufficient: 0 };
      entry.pass += counts.pass;
      entry.fail += counts.fail;
      entry.insufficient += counts.insufficient;
      roleMap.set(role, entry);
    }
    const bySourceRole = sortedByVolume(
      [...roleMap.entries()].map(([role, v]) => ({ role, ...v })),
    );

    const topInsufficientReasons = insufficientReasonGroups
      .map((g) => ({
        reason: (g.reason as string | null) ?? "(no reason recorded)",
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRows,
      totalPass,
      totalFail,
      totalInsufficient,
      byContentType,
      bySourceHost,
      byField,
      bySourceRole,
      topInsufficientReasons,
      recent: rows,
    };
  } catch (e) {
    logger.warn("validation-evidence.summary_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return EMPTY_SUMMARY;
  }
}
