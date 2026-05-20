/**
 * Source-role auto-sync job.
 *
 * Reads rolling SourceQualityScore stats per source, aggregates them
 * across content types, and applies the promotion / demotion rules
 * in `decideRoleTransition()`. Producing a public package
 * consistently moves a source from `discovery_only_source` →
 * `validation_source` → `primary_content_source`. Producing repeated
 * wrong-content moves it back down or out to `rejected_source`.
 *
 * Idempotent: when no transition is warranted the source row is
 * left untouched. Used by the cron tick.
 */

import { prisma } from "../../db/client";
import { logger } from "../../observability/logger";
import { decideRoleTransition, isSourceRole, type SourceRole } from "./roles";

export type RoleSyncReport = {
  inspected: number;
  promoted: number;
  demoted: number;
  rejected: number;
  unchanged: number;
  errors: number;
};

type SourceRow = {
  id: string;
  host: string;
  role: string;
};

type ScoreRow = {
  sourceId: string;
  buildSuccessCount: number;
  buildFailureCount: number;
  qaPassCount: number;
  qaFailCount: number;
  wrongContentCount: number;
  duplicateCount: number;
};

function aggregate(scores: ScoreRow[]): {
  buildAttempts: number;
  buildSuccesses: number;
  qaPasses: number;
  qaFailures: number;
  wrongContent: number;
  duplicates: number;
} {
  let buildAttempts = 0;
  let buildSuccesses = 0;
  let qaPasses = 0;
  let qaFailures = 0;
  let wrongContent = 0;
  let duplicates = 0;
  for (const s of scores) {
    buildAttempts += s.buildSuccessCount + s.buildFailureCount;
    buildSuccesses += s.buildSuccessCount;
    qaPasses += s.qaPassCount;
    qaFailures += s.qaFailCount;
    wrongContent += s.wrongContentCount;
    duplicates += s.duplicateCount;
  }
  return { buildAttempts, buildSuccesses, qaPasses, qaFailures, wrongContent, duplicates };
}

export async function runRoleSync(): Promise<RoleSyncReport> {
  const report: RoleSyncReport = {
    inspected: 0,
    promoted: 0,
    demoted: 0,
    rejected: 0,
    unchanged: 0,
    errors: 0,
  };

  let sources: SourceRow[] = [];
  try {
    sources = (await prisma.ingestionSource.findMany({
      where: { isActive: true },
      select: { id: true, host: true, role: true },
      take: 1000,
    })) as unknown as SourceRow[];
  } catch (e) {
    logger.warn("role-sync.read_sources_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    report.errors += 1;
    return report;
  }

  for (const source of sources) {
    report.inspected += 1;
    if (!isSourceRole(source.role)) {
      report.errors += 1;
      continue;
    }
    let scores: ScoreRow[] = [];
    try {
      scores = (await prisma.sourceQualityScore.findMany({
        where: { sourceId: source.id },
        select: {
          sourceId: true,
          buildSuccessCount: true,
          buildFailureCount: true,
          qaPassCount: true,
          qaFailCount: true,
          wrongContentCount: true,
          duplicateCount: true,
        },
      })) as unknown as ScoreRow[];
    } catch (e) {
      report.errors += 1;
      logger.warn("role-sync.read_scores_failed", {
        sourceId: source.id,
        error: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    if (scores.length === 0) {
      report.unchanged += 1;
      continue;
    }

    const stats = aggregate(scores);
    const transition = decideRoleTransition(source.role as SourceRole, stats);
    if (!transition) {
      report.unchanged += 1;
      continue;
    }

    try {
      await prisma.ingestionSource.update({
        where: { id: source.id },
        data: {
          role: transition.toRole,
          roleLastReason: transition.reason,
          roleLastChangedAt: new Date(),
        },
      });
      if (transition.toRole === "rejected_source") report.rejected += 1;
      else if (rolePriority(transition.toRole) > rolePriority(transition.fromRole as SourceRole))
        report.promoted += 1;
      else report.demoted += 1;
      logger.info("role-sync.transition_applied", {
        sourceId: source.id,
        from: transition.fromRole,
        to: transition.toRole,
        reason: transition.reason,
      });
    } catch (e) {
      report.errors += 1;
      logger.warn("role-sync.update_failed", {
        sourceId: source.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return report;
}

function rolePriority(role: SourceRole): number {
  switch (role) {
    case "primary_content_source":
      return 4;
    case "validation_source":
      return 3;
    case "enrichment_source":
      return 2;
    case "discovery_only_source":
      return 1;
    case "rejected_source":
      return 0;
  }
}
