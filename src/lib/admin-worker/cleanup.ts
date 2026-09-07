/**
 * Cleanup custodian. Runs during MAINTENANCE passes: prunes stale
 * candidate URLs, closes expired human-review rows, trims the growth-snapshot
 * ledger, and writes log entries for any cleanup action taken.
 *
 * It never touches PublishedContent, and it never expires a review that is
 * the only open signal for content the worker itself unpublished.
 */

import type { PrismaClient } from "@prisma/client";

import { isNonContentHost } from "@/lib/checklist/sources/authority-registry";

import { OPERATOR_FILE_HOST } from "./file-ingest";
import { writeAdminWorkerLog } from "./logs";

export interface CleanupOutcome {
  staleCandidatesRemoved: number;
  expiredReviewsClosed: number;
  junkHostRowsPurged: number;
  /** AdminWorkerGrowthSnapshot rows trimmed beyond the per-type retention. */
  growthSnapshotsTrimmed: number;
  /** Bookkeeping-ledger rows deleted by the hourly retention prune. */
  ledgerRowsPruned: number;
}

/* ------------------------------------------------------------------ */
/* ledger retention                                                     */
/* ------------------------------------------------------------------ */

/**
 * Every pass appends ~35 bookkeeping rows (INFO logs, one ActionScore per
 * ranked alternative, brain-call records, stage outcomes) and nothing ever
 * removed them (audit LIVE-2e), so the tables the diagnostics / governor /
 * readiness readers scan grew without bound. Retention is short and only for
 * ledgers that are re-derived every pass. WARN/ERROR logs, published content
 * and every content table are untouched.
 *
 * The first version of this prune covered only four tables and MISSED the two
 * largest in production: on 2026-09-07 the live database was 21 GB, of which
 * AdminWorkerDecision was 5.7 GB and AdminWorkerLog 3.3 GB against 12 MB of
 * actual PublishedContent. Decisions, passes and terminal repair plans are now
 * trimmed too — children before AdminWorkerPass, which is the parent.
 */
const LEDGER_PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const LEDGER_PRUNE_BATCH = 5000;
/** Bounds one prune to ~100k rows per table so a first run never holds a pass. */
const LEDGER_PRUNE_MAX_BATCHES = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
export const LOG_INFO_RETENTION_MS = 14 * DAY_MS;
export const ACTION_SCORE_RETENTION_MS = 14 * DAY_MS;
export const BRAIN_CALL_RETENTION_MS = 14 * DAY_MS;
export const STAGE_OUTCOME_RETENTION_MS = 30 * DAY_MS;
/**
 * The three tables this prune originally MISSED, and which turned out to be the
 * bulk of the 21 GB production database measured on 2026-09-07:
 * AdminWorkerDecision 993,364 rows / 5.7 GB, AdminWorkerPass 993,406 rows /
 * 440 MB, AdminWorkerRepairPlan 49,534 rows / 27 MB. They are per-pass
 * bookkeeping, re-derived every pass, and nothing reads them beyond a short
 * window (the audit view, the governor's fixation check, escalation).
 */
export const DECISION_RETENTION_MS = 14 * DAY_MS;
export const PASS_RETENTION_MS = 14 * DAY_MS;
export const REPAIR_PLAN_RETENTION_MS = 30 * DAY_MS;

let _lastLedgerPruneAt = 0;

export interface LedgerPruneOutcome {
  /** False when throttled (ran within the last hour) or the client has no raw SQL. */
  ran: boolean;
  logRows: number;
  actionScores: number;
  brainCalls: number;
  stageOutcomes: number;
  /** Terminal repair plans (PENDING/RUNNING plans are never trimmed). */
  repairPlans: number;
  decisions: number;
  /** Terminal passes only — a RUNNING row still belongs to a live process. */
  passes: number;
}

/** Sum of every table in a prune outcome — the number the report renders. */
export function totalLedgerRowsPruned(out: LedgerPruneOutcome): number {
  return (
    out.logRows +
    out.actionScores +
    out.brainCalls +
    out.stageOutcomes +
    out.repairPlans +
    out.decisions +
    out.passes
  );
}

/** Delete in id-subselect batches until a batch comes back short (or the cap). */
async function deleteInBatches(run: () => Promise<number>): Promise<number> {
  let total = 0;
  for (let i = 0; i < LEDGER_PRUNE_MAX_BATCHES; i += 1) {
    let n: number;
    try {
      n = await run();
    } catch {
      break; // fail-open: the next hourly prune resumes where this one stopped
    }
    total += n;
    if (n < LEDGER_PRUNE_BATCH) break;
  }
  return total;
}

/**
 * Hourly (per process) retention prune of the seven append-only ledgers.
 * Batched `DELETE … WHERE id IN (SELECT id … LIMIT 5000)` keeps each statement
 * short-lived against the remote database; fail-open per table; a no-op on a
 * client/mock without `$executeRaw`. `force` bypasses the throttle (tests,
 * operator maintenance).
 */
export async function pruneLedgerRows(
  prisma: PrismaClient,
  opts: { now?: number; force?: boolean } = {},
): Promise<LedgerPruneOutcome> {
  const now = opts.now ?? Date.now();
  const out: LedgerPruneOutcome = {
    ran: false,
    logRows: 0,
    actionScores: 0,
    brainCalls: 0,
    stageOutcomes: 0,
    repairPlans: 0,
    decisions: 0,
    passes: 0,
  };
  if (!opts.force && now - _lastLedgerPruneAt < LEDGER_PRUNE_INTERVAL_MS) return out;
  if (typeof (prisma as { $executeRaw?: unknown }).$executeRaw !== "function") return out;
  _lastLedgerPruneAt = now;
  out.ran = true;

  const logCutoff = new Date(now - LOG_INFO_RETENTION_MS);
  const scoreCutoff = new Date(now - ACTION_SCORE_RETENTION_MS);
  const brainCutoff = new Date(now - BRAIN_CALL_RETENTION_MS);
  const stageCutoff = new Date(now - STAGE_OUTCOME_RETENTION_MS);
  const planCutoff = new Date(now - REPAIR_PLAN_RETENTION_MS);
  const decisionCutoff = new Date(now - DECISION_RETENTION_MS);
  const passCutoff = new Date(now - PASS_RETENTION_MS);
  const batch = LEDGER_PRUNE_BATCH;

  // Only INFO rows: WARN/ERROR are the audit trail escalation reads back.
  out.logRows = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerLog" WHERE "id" IN (SELECT "id" FROM "AdminWorkerLog" WHERE "severity" = 'INFO' AND "createdAt" < ${logCutoff} LIMIT ${batch})`,
  );
  out.actionScores = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerActionScore" WHERE "id" IN (SELECT "id" FROM "AdminWorkerActionScore" WHERE "createdAt" < ${scoreCutoff} LIMIT ${batch})`,
  );
  out.brainCalls = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerBrainCall" WHERE "id" IN (SELECT "id" FROM "AdminWorkerBrainCall" WHERE "createdAt" < ${brainCutoff} LIMIT ${batch})`,
  );
  out.stageOutcomes = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerStageOutcome" WHERE "id" IN (SELECT "id" FROM "AdminWorkerStageOutcome" WHERE "createdAt" < ${stageCutoff} LIMIT ${batch})`,
  );
  // Only TERMINAL plans: a PENDING/RUNNING plan is live repair work.
  out.repairPlans = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerRepairPlan" WHERE "id" IN (SELECT "id" FROM "AdminWorkerRepairPlan" WHERE "status" IN ('SUCCEEDED', 'FAILED', 'ABANDONED') AND "createdAt" < ${planCutoff} LIMIT ${batch})`,
  );
  // ORDER MATTERS (same rationale as scripts/maintenance/prune-worker-ledger.ts):
  // AdminWorkerPass has five inbound foreign keys declared ON DELETE SET NULL,
  // so every child left behind when a parent pass is deleted is REWRITTEN. Trim
  // the children first and the parent last, or Postgres spends the whole prune
  // nulling columns on rows that are about to be deleted anyway.
  out.decisions = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerDecision" WHERE "id" IN (SELECT "id" FROM "AdminWorkerDecision" WHERE "createdAt" < ${decisionCutoff} LIMIT ${batch})`,
  );
  // Never a RUNNING pass: that row belongs to a live process (or to the stale
  // reaper), and deleting it would erase an in-flight pass mid-life.
  out.passes = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerPass" WHERE "id" IN (SELECT "id" FROM "AdminWorkerPass" WHERE "status" <> 'RUNNING' AND "startedAt" < ${passCutoff} LIMIT ${batch})`,
  );
  return out;
}

/**
 * Review rows filed by the post-publish rollback after it UNPUBLISHED a row
 * (post-publish-rollback.ts). Until a person decides restore-vs-delete, the
 * content stays hidden and the PENDING review is the only open signal that it
 * exists — so these must never be aged out into EXPIRED (which quietly turned
 * "awaiting a decision" into "unpublished forever, nobody looking").
 */
export const ROLLBACK_REVIEW_ACTIONS: readonly string[] = [
  "restore_or_delete_unpublished_content",
  "investigate_post_publish_failure",
];

/** Growth snapshots kept per content type (roughly a month of hourly runs' worth of change). */
const GROWTH_SNAPSHOTS_KEPT_PER_TYPE = 30;

/**
 * Keep only the newest N AdminWorkerGrowthSnapshot rows per content type. The
 * orchestrator writes one row per goal every run and nothing pruned them, so
 * the governor's REPORTING fallback grew the table without bound. Fail-open;
 * tolerates a client/mock without groupBy.
 */
async function trimGrowthSnapshots(prisma: PrismaClient): Promise<number> {
  try {
    const model = (
      prisma as unknown as {
        adminWorkerGrowthSnapshot?: { groupBy?: unknown; findMany?: unknown; deleteMany?: unknown };
      }
    ).adminWorkerGrowthSnapshot;
    if (
      typeof model?.groupBy !== "function" ||
      typeof model?.findMany !== "function" ||
      typeof model?.deleteMany !== "function"
    ) {
      return 0;
    }
    const groups = await prisma.adminWorkerGrowthSnapshot.groupBy({
      by: ["contentType"],
      _count: { _all: true },
    });
    let trimmed = 0;
    for (const g of groups) {
      if (g._count._all <= GROWTH_SNAPSHOTS_KEPT_PER_TYPE) continue;
      const stale = await prisma.adminWorkerGrowthSnapshot.findMany({
        where: { contentType: g.contentType },
        orderBy: { createdAt: "desc" },
        skip: GROWTH_SNAPSHOTS_KEPT_PER_TYPE,
        select: { id: true },
      });
      if (stale.length === 0) continue;
      const res = await prisma.adminWorkerGrowthSnapshot.deleteMany({
        where: { id: { in: stale.map((r) => r.id) } },
      });
      trimmed += res.count;
    }
    return trimmed;
  } catch {
    return 0;
  }
}

/**
 * Purge already-ingested pollution from non-content hosts (social / commerce /
 * free personal-site builders like the gabiula.pl.tl runaway). Deletes their
 * candidate URLs and neutralizes their source-reads (nulling detectedContentType
 * so they can never re-seed the internal-link crawler). Self-healing: runs every
 * maintenance pass, so once the host block ships the existing junk drains without
 * operator action. Fail-open.
 */
async function purgeNonContentHostRows(prisma: PrismaClient): Promise<number> {
  try {
    const hosts = await prisma.candidateSourceUrl
      .findMany({ distinct: ["sourceHost"], select: { sourceHost: true }, take: 2000 })
      .catch(() => [] as Array<{ sourceHost: string }>);
    // `operator-file.local` is a SYNTHETIC provenance host for files the operator
    // handed the worker directly — not a network host. It matches the
    // non-content `/\.local$/` pattern (correctly: the worker must never try to
    // fetch it), but purging it here would delete the operator's own material
    // and null the classification off every ingested document, silently undoing
    // an ingestion hours after it succeeded. Exclude it explicitly.
    const blocked = hosts
      .map((h) => h.sourceHost)
      .filter((h) => h !== OPERATOR_FILE_HOST && isNonContentHost(h));
    if (blocked.length === 0) return 0;
    const delCandidates = await prisma.candidateSourceUrl
      .deleteMany({ where: { sourceHost: { in: blocked } } })
      .catch(() => ({ count: 0 }));
    // Neutralize reads so they drop out of the internal-link seed query.
    await prisma.adminWorkerSourceRead
      .updateMany({
        where: {
          sourceHost: { in: blocked, not: OPERATOR_FILE_HOST },
          detectedContentType: { not: null },
        },
        data: { detectedContentType: null },
      })
      .catch(() => undefined);
    return delCandidates.count;
  } catch {
    return 0;
  }
}

const CANDIDATE_STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REVIEW_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

export async function runCleanupPass(prisma: PrismaClient): Promise<CleanupOutcome> {
  const candidateCutoff = new Date(Date.now() - CANDIDATE_STALE_MS);
  const staleCandidates = await prisma.candidateSourceUrl.deleteMany({
    where: { status: "REJECTED", updatedAt: { lt: candidateCutoff } },
  });

  const reviewCutoff = new Date(Date.now() - REVIEW_EXPIRY_MS);
  const expiredReviews = await prisma.humanReviewQueue.updateMany({
    where: {
      status: "PENDING",
      createdAt: { lt: reviewCutoff },
      // Rollback/unpublish reviews wait for a human decision indefinitely.
      proposedAction: { notIn: [...ROLLBACK_REVIEW_ACTIONS] },
    },
    data: { status: "EXPIRED", reviewedAt: new Date() },
  });

  const junkHostRowsPurged = await purgeNonContentHostRows(prisma);
  const growthSnapshotsTrimmed = await trimGrowthSnapshots(prisma);
  const ledger = await pruneLedgerRows(prisma);
  const ledgerRowsPruned = totalLedgerRowsPruned(ledger);

  await writeAdminWorkerLog(prisma, {
    category: "CLEANUP",
    severity: junkHostRowsPurged > 0 ? "WARN" : "INFO",
    eventName: "cleanup_completed",
    message: `Cleanup pass: removed ${staleCandidates.count} stale rejected candidates, expired ${expiredReviews.count} review items, purged ${junkHostRowsPurged} non-content-host candidate(s), trimmed ${growthSnapshotsTrimmed} growth snapshot(s)${ledger.ran ? `, pruned ${ledgerRowsPruned} ledger row(s)` : ""}.`,
    safeMetadata: ledger.ran ? { ledger: { ...ledger } } : undefined,
  });

  return {
    staleCandidatesRemoved: staleCandidates.count,
    expiredReviewsClosed: expiredReviews.count,
    junkHostRowsPurged,
    growthSnapshotsTrimmed,
    ledgerRowsPruned,
  };
}
