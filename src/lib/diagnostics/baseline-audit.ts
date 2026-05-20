/**
 * Baseline content audit.
 *
 * The baseline seeder drives one canonical fixture per content type
 * through the real content factory. This audit traces each of those
 * baseline fixtures from its known source URL through to the public
 * catalog and reports, per fixture:
 *
 *   - whether a source document was created
 *   - build attempts + complete builds
 *   - whether a public package exists
 *   - failure count + failure reasons
 *
 * Read-side only. A failed query records an error rather than a
 * false zero.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { BASELINE_SEED_FIXTURES } from "../content-factory/baseline-seed";

const COMPLETE_BUILD_STATUS = "built_complete_package";

const PUBLIC_MODEL: Record<string, string> = {
  Prayer: "prayer",
  Saint: "saint",
  MarianApparition: "marianApparition",
  Parish: "parish",
  Devotion: "devotion",
  Novena: "devotion",
  Sacrament: "spiritualLifeGuide",
  Rosary: "spiritualLifeGuide",
  Consecration: "spiritualLifeGuide",
  SpiritualGuidance: "spiritualLifeGuide",
  Liturgy: "liturgyEntry",
  History: "liturgyEntry",
};

export type BaselineAuditRow = {
  contentType: string;
  slug: string;
  title: string;
  sourceUrl: string;
  sourceDocumentCreated: boolean;
  buildAttempts: number;
  completeBuilds: number;
  publicPackage: boolean;
  failures: number;
  failureReasons: string[];
  status: "complete" | "failed" | "pending";
  errors: string[];
};

export type BaselineAuditReport = {
  generatedAt: Date;
  rows: BaselineAuditRow[];
  totalSourceDocuments: number;
  totalBuildAttempts: number;
  totalCompleteBuilds: number;
  totalPublicPackages: number;
  totalFailures: number;
  /** True when every baseline fixture reached the public catalog. */
  healthy: boolean;
};

async function safe<T>(fn: () => Promise<T>, fallback: T, errors: string[]): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    return fallback;
  }
}

async function auditFixture(fx: {
  contentType: string;
  slug: string;
  title: string;
  sourceUrl: string;
}): Promise<BaselineAuditRow> {
  const errors: string[] = [];

  const sourceDoc = await safe(
    () =>
      prisma.sourceDocument.findUnique({
        where: { sourceUrl: fx.sourceUrl },
        select: { id: true },
      }),
    null,
    errors,
  );

  const buildLogs = await safe(
    () =>
      prisma.contentPackageBuildLog.findMany({
        where: { sourceUrl: fx.sourceUrl },
        select: { buildStatus: true, failureReason: true },
      }),
    [] as Array<{ buildStatus: string; failureReason: string | null }>,
    errors,
  );
  const buildAttempts = buildLogs.length;
  const completeBuilds = buildLogs.filter((b) => b.buildStatus === COMPLETE_BUILD_STATUS).length;

  const rejected = await safe(
    () =>
      prisma.rejectedContentLog.findMany({
        where: { sourceUrl: fx.sourceUrl },
        select: { rejectionReason: true },
      }),
    [] as Array<{ rejectionReason: string }>,
    errors,
  );

  const failureReasons = [
    ...buildLogs
      .filter((b) => b.buildStatus !== COMPLETE_BUILD_STATUS && b.failureReason)
      .map((b) => b.failureReason as string),
    ...rejected.map((r) => r.rejectionReason),
  ];

  const model = PUBLIC_MODEL[fx.contentType];
  let publicPackage = false;
  if (model) {
    const delegate = (
      prisma as unknown as Record<
        string,
        { findFirst: (a: { where: unknown; select?: unknown }) => Promise<unknown | null> }
      >
    )[model];
    if (delegate) {
      const row = await safe(
        () => delegate.findFirst({ where: { slug: fx.slug }, select: { id: true } }),
        null,
        errors,
      );
      publicPackage = row != null;
    }
  }

  const failures = failureReasons.length;
  const status: BaselineAuditRow["status"] = publicPackage
    ? "complete"
    : failures > 0 || (buildAttempts > 0 && completeBuilds === 0)
      ? "failed"
      : "pending";

  return {
    contentType: fx.contentType,
    slug: fx.slug,
    title: fx.title,
    sourceUrl: fx.sourceUrl,
    sourceDocumentCreated: sourceDoc != null,
    buildAttempts,
    completeBuilds,
    publicPackage,
    failures,
    failureReasons: [...new Set(failureReasons)].slice(0, 8),
    status,
    errors,
  };
}

/**
 * Build the baseline content audit report.
 */
export async function getBaselineAuditReport(): Promise<BaselineAuditReport> {
  const rows = await Promise.all(
    BASELINE_SEED_FIXTURES.map((fx) =>
      auditFixture({
        contentType: fx.contentType,
        slug: fx.slug,
        title: fx.title,
        sourceUrl: fx.sourceUrl,
      }),
    ),
  ).catch((e) => {
    logger.warn("baseline-audit.failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return [] as BaselineAuditRow[];
  });

  return {
    generatedAt: new Date(),
    rows,
    totalSourceDocuments: rows.filter((r) => r.sourceDocumentCreated).length,
    totalBuildAttempts: rows.reduce((sum, r) => sum + r.buildAttempts, 0),
    totalCompleteBuilds: rows.reduce((sum, r) => sum + r.completeBuilds, 0),
    totalPublicPackages: rows.filter((r) => r.publicPackage).length,
    totalFailures: rows.reduce((sum, r) => sum + r.failures, 0),
    healthy: rows.length > 0 && rows.every((r) => r.status === "complete"),
  };
}
