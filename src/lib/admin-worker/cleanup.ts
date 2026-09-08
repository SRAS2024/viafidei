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
 * ledgers that are re-derived every pass. Published content and every content
 * table are untouched; WARN/ERROR logs keep a much longer (but finite) window
 * than INFO, because "never trimmed" is itself an unbounded growth channel.
 *
 * The first version of this prune covered only four tables and MISSED the two
 * largest in production: on 2026-09-07 the live database was 21 GB, of which
 * AdminWorkerDecision was 5.7 GB and AdminWorkerLog 3.3 GB against 12 MB of
 * actual PublishedContent. Decisions, passes and terminal repair plans are now
 * trimmed too — children before AdminWorkerPass, which is the parent.
 */
const LEDGER_PRUNE_INTERVAL_MS = 60 * 60 * 1000;
export const LEDGER_PRUNE_BATCH = 5000;
/** Bounds one prune to ~100k rows per table so a first run never holds a pass. */
export const LEDGER_PRUNE_MAX_BATCHES = 20;
/**
 * The ceiling `maxBatches` may be raised to when a caller has SENSED a backlog
 * far larger than the default capacity (self-maintenance's trim repair). At
 * 5,000 rows a batch that is 1 M rows per table per call — enough to drain the
 * measured 16.9 M-row AdminWorkerActionScore backlog in ~17 calls instead of
 * 169, while still bounded so one prune can never hold a pass indefinitely.
 */
export const LEDGER_PRUNE_MAX_BATCHES_BACKLOG = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
export const LOG_INFO_RETENTION_MS = 14 * DAY_MS;
/**
 * WARN/ERROR log rows are the audit trail, so they get a long window rather
 * than none at all — "never trimmed" is an unbounded growth channel, and
 * several per-pass events are WARN (governor_forced_stage, worker_lanes when a
 * lane errored, post_publish_verified on a WARN probe, log_event_sampled).
 */
export const LOG_AUDIT_RETENTION_MS = 90 * DAY_MS;
export const ACTION_SCORE_RETENTION_MS = 14 * DAY_MS;
export const BRAIN_CALL_RETENTION_MS = 14 * DAY_MS;
export const STAGE_OUTCOME_RETENTION_MS = 30 * DAY_MS;
/**
 * The three tables the production post-mortem named that autonomous retention
 * still did not cover — only the operator script did:
 * AdminWorkerReasoningGraph 1,976,739 rows / 557 MB (one row per brain
 * decision), AdminWorkerCalibrationHistory 1,548,893 / 196 MB (one per
 * intelligence pass) and AdminWorkerStucknessRecord 207,830 / 63 MB (one per
 * stuckness detection — exactly the worker_stuck event count).
 * PostPublishVerification is here for the same reason: the verify stage writes
 * one row per probe and re-probes the same rows forever while a WARN persists.
 */
export const REASONING_GRAPH_RETENTION_MS = 14 * DAY_MS;
export const CALIBRATION_RETENTION_MS = 30 * DAY_MS;
export const STUCKNESS_RETENTION_MS = 30 * DAY_MS;
export const POST_PUBLISH_VERIFICATION_RETENTION_MS = 30 * DAY_MS;
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
  /** WARN/ERROR log rows past the long audit window. */
  auditLogRows: number;
  actionScores: number;
  brainCalls: number;
  stageOutcomes: number;
  /** Terminal repair plans (PENDING/RUNNING plans are never trimmed). */
  repairPlans: number;
  decisions: number;
  reasoningGraph: number;
  calibrationHistory: number;
  stucknessRecords: number;
  postPublishVerifications: number;
  /** Terminal passes only — a RUNNING row still belongs to a live process. */
  passes: number;
  /** Relations a plain VACUUM was issued on after a large delete. */
  vacuumed: string[];
}

/** Sum of every table in a prune outcome — the number the report renders. */
export function totalLedgerRowsPruned(out: LedgerPruneOutcome): number {
  return (
    out.logRows +
    out.auditLogRows +
    out.actionScores +
    out.brainCalls +
    out.stageOutcomes +
    out.repairPlans +
    out.decisions +
    out.reasoningGraph +
    out.calibrationHistory +
    out.stucknessRecords +
    out.postPublishVerifications +
    out.passes
  );
}

/**
 * Default wall-clock budget for one whole prune. The raised backlog cap is
 * bounded in ROWS; this bounds it in TIME, so a prune can never hold the lane
 * that called it (maint-self-heal's watchdog is 6 minutes) no matter how many
 * tables are backlogged at once. Whatever is left drains on the next call.
 */
export const LEDGER_PRUNE_TIME_BUDGET_MS = 60_000;

/**
 * Delete in id-subselect batches until a batch comes back short, the cap, or
 * the time budget.
 */
async function deleteInBatches(
  run: () => Promise<number>,
  maxBatches: number,
  deadline: number,
): Promise<number> {
  let total = 0;
  for (let i = 0; i < maxBatches; i += 1) {
    if (Date.now() > deadline) break;
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
 * The ONLY relation names this module will ever interpolate into SQL, and the
 * only ones VACUUM may be issued against. Nothing here is ever built from a
 * caller-supplied string.
 */
export const VACUUMABLE_TABLES: readonly string[] = [
  "AdminWorkerLog",
  "AdminWorkerActionScore",
  "AdminWorkerBrainCall",
  "AdminWorkerStageOutcome",
  "AdminWorkerRepairPlan",
  "AdminWorkerDecision",
  "AdminWorkerReasoningGraph",
  "AdminWorkerCalibrationHistory",
  "AdminWorkerStucknessRecord",
  "PostPublishVerification",
  "AdminWorkerPass",
];

/**
 * Issue a PLAIN `VACUUM (ANALYZE)` on relations a prune just emptied out.
 *
 * THE MEASURED LESSON (production, 2026-09-07): deleting 7,096,270 rows left
 * the database still reporting 12 GB, because a DELETE only marks tuples dead —
 * the files keep their size until something reclaims them. `pruneLedgerRows`
 * had been deleting for months and the database still grew, because autovacuum
 * reported "never" on the big tables. A plain VACUUM makes the space REUSABLE
 * (so the table stops growing) and refreshes reltuples/n_dead_tup, which is
 * also what makes the size signals trustworthy again.
 *
 * Never VACUUM FULL: that takes an ACCESS EXCLUSIVE lock and rewrites the
 * table. Reclaiming disk outright stays an operator action
 * (scripts/maintenance/prune-worker-ledger.ts --railway --confirm --vacuum),
 * which self-maintenance escalates for.
 *
 * VACUUM cannot run inside a transaction block, so this uses `$executeRawUnsafe`
 * on a name from the allow-list above — never on interpolated input. Fail-open
 * per table: a role without permission to vacuum simply does not.
 */
export async function vacuumLedgerTables(
  prisma: PrismaClient,
  tables: readonly string[],
): Promise<string[]> {
  const run = (prisma as { $executeRawUnsafe?: (sql: string) => Promise<unknown> })
    .$executeRawUnsafe;
  if (typeof run !== "function") return [];
  const done: string[] = [];
  for (const table of tables) {
    if (!VACUUMABLE_TABLES.includes(table)) continue;
    try {
      await run.call(prisma, `VACUUM (ANALYZE) "${table}"`);
      done.push(table);
    } catch {
      // A managed role may not own the relation; the next prune retries.
    }
  }
  return done;
}

/**
 * Hourly (per process) retention prune of every append-only worker ledger.
 * Batched `DELETE … WHERE id IN (SELECT id … LIMIT 5000)` keeps each statement
 * short-lived against the remote database; fail-open per table; a no-op on a
 * client/mock without `$executeRaw`. `force` bypasses the throttle (tests,
 * operator maintenance) and `maxBatches` raises the per-table cap for a caller
 * that has sensed a backlog far larger than the default capacity.
 *
 * Finishes with a plain VACUUM on the relations it emptied by a full batch or
 * more, because deleting rows alone never returned any space in production.
 */
export async function pruneLedgerRows(
  prisma: PrismaClient,
  opts: { now?: number; force?: boolean; maxBatches?: number; timeBudgetMs?: number } = {},
): Promise<LedgerPruneOutcome> {
  const now = opts.now ?? Date.now();
  const out: LedgerPruneOutcome = {
    ran: false,
    logRows: 0,
    auditLogRows: 0,
    actionScores: 0,
    brainCalls: 0,
    stageOutcomes: 0,
    repairPlans: 0,
    decisions: 0,
    reasoningGraph: 0,
    calibrationHistory: 0,
    stucknessRecords: 0,
    postPublishVerifications: 0,
    passes: 0,
    vacuumed: [],
  };
  if (!opts.force && now - _lastLedgerPruneAt < LEDGER_PRUNE_INTERVAL_MS) return out;
  if (typeof (prisma as { $executeRaw?: unknown }).$executeRaw !== "function") return out;
  _lastLedgerPruneAt = now;
  out.ran = true;

  // A caller that has SENSED a backlog far larger than the default capacity
  // (self-maintenance's trim repair) may raise the cap for this call. Bounded
  // either way: 100k rows per table by default, 1 M under a sensed backlog.
  const maxBatches = Math.max(
    1,
    Math.min(
      LEDGER_PRUNE_MAX_BATCHES_BACKLOG,
      Math.trunc(opts.maxBatches ?? 0) || LEDGER_PRUNE_MAX_BATCHES,
    ),
  );
  const deadline = Date.now() + Math.max(1_000, opts.timeBudgetMs ?? LEDGER_PRUNE_TIME_BUDGET_MS);

  const logCutoff = new Date(now - LOG_INFO_RETENTION_MS);
  const auditLogCutoff = new Date(now - LOG_AUDIT_RETENTION_MS);
  const reasoningCutoff = new Date(now - REASONING_GRAPH_RETENTION_MS);
  const calibrationCutoff = new Date(now - CALIBRATION_RETENTION_MS);
  const stucknessCutoff = new Date(now - STUCKNESS_RETENTION_MS);
  const verificationCutoff = new Date(now - POST_PUBLISH_VERIFICATION_RETENTION_MS);
  const scoreCutoff = new Date(now - ACTION_SCORE_RETENTION_MS);
  const brainCutoff = new Date(now - BRAIN_CALL_RETENTION_MS);
  const stageCutoff = new Date(now - STAGE_OUTCOME_RETENTION_MS);
  const planCutoff = new Date(now - REPAIR_PLAN_RETENTION_MS);
  const decisionCutoff = new Date(now - DECISION_RETENTION_MS);
  const passCutoff = new Date(now - PASS_RETENTION_MS);
  const batch = LEDGER_PRUNE_BATCH;

  // Only INFO rows on the short window: WARN/ERROR are the audit trail that
  // escalation reads back, and they get the long window below rather than none.
  out.logRows = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerLog" WHERE "id" IN (SELECT "id" FROM "AdminWorkerLog" WHERE "severity" = 'INFO' AND "createdAt" < ${logCutoff} LIMIT ${batch})`,
    maxBatches,
    deadline,
  );
  out.auditLogRows = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerLog" WHERE "id" IN (SELECT "id" FROM "AdminWorkerLog" WHERE "severity" <> 'INFO' AND "createdAt" < ${auditLogCutoff} LIMIT ${batch})`,
    maxBatches,
    deadline,
  );
  out.actionScores = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerActionScore" WHERE "id" IN (SELECT "id" FROM "AdminWorkerActionScore" WHERE "createdAt" < ${scoreCutoff} LIMIT ${batch})`,
    maxBatches,
    deadline,
  );
  out.brainCalls = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerBrainCall" WHERE "id" IN (SELECT "id" FROM "AdminWorkerBrainCall" WHERE "createdAt" < ${brainCutoff} LIMIT ${batch})`,
    maxBatches,
    deadline,
  );
  out.stageOutcomes = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerStageOutcome" WHERE "id" IN (SELECT "id" FROM "AdminWorkerStageOutcome" WHERE "createdAt" < ${stageCutoff} LIMIT ${batch})`,
    maxBatches,
    deadline,
  );
  // Only TERMINAL plans: a PENDING/RUNNING plan is live repair work.
  out.repairPlans = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerRepairPlan" WHERE "id" IN (SELECT "id" FROM "AdminWorkerRepairPlan" WHERE "status" IN ('SUCCEEDED', 'FAILED', 'ABANDONED') AND "createdAt" < ${planCutoff} LIMIT ${batch})`,
    maxBatches,
    deadline,
  );
  // The three tables the post-mortem named that only the OPERATOR script
  // covered: one row per brain decision, one per intelligence pass, one per
  // stuckness detection. Nothing reads any of them beyond a recent window.
  out.reasoningGraph = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerReasoningGraph" WHERE "id" IN (SELECT "id" FROM "AdminWorkerReasoningGraph" WHERE "createdAt" < ${reasoningCutoff} LIMIT ${batch})`,
    maxBatches,
    deadline,
  );
  out.calibrationHistory = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerCalibrationHistory" WHERE "id" IN (SELECT "id" FROM "AdminWorkerCalibrationHistory" WHERE "createdAt" < ${calibrationCutoff} LIMIT ${batch})`,
    maxBatches,
    deadline,
  );
  out.stucknessRecords = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerStucknessRecord" WHERE "id" IN (SELECT "id" FROM "AdminWorkerStucknessRecord" WHERE "createdAt" < ${stucknessCutoff} LIMIT ${batch})`,
    maxBatches,
    deadline,
  );
  out.postPublishVerifications = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "PostPublishVerification" WHERE "id" IN (SELECT "id" FROM "PostPublishVerification" WHERE "createdAt" < ${verificationCutoff} LIMIT ${batch})`,
    maxBatches,
    deadline,
  );
  // ORDER MATTERS (same rationale as scripts/maintenance/prune-worker-ledger.ts):
  // AdminWorkerPass has five inbound foreign keys declared ON DELETE SET NULL,
  // so every child left behind when a parent pass is deleted is REWRITTEN. Trim
  // the children first and the parent last, or Postgres spends the whole prune
  // nulling columns on rows that are about to be deleted anyway.
  out.decisions = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerDecision" WHERE "id" IN (SELECT "id" FROM "AdminWorkerDecision" WHERE "createdAt" < ${decisionCutoff} LIMIT ${batch})`,
    maxBatches,
    deadline,
  );
  // Never a RUNNING pass: that row belongs to a live process (or to the stale
  // reaper), and deleting it would erase an in-flight pass mid-life.
  out.passes = await deleteInBatches(
    () =>
      prisma.$executeRaw`DELETE FROM "AdminWorkerPass" WHERE "id" IN (SELECT "id" FROM "AdminWorkerPass" WHERE "status" <> 'RUNNING' AND "startedAt" < ${passCutoff} LIMIT ${batch})`,
    maxBatches,
    deadline,
  );

  // Reclaim. A DELETE only marks tuples dead — the measured production lesson
  // is that months of successful prunes still left a 21 GB database because
  // nothing ever vacuumed. Only relations this call actually emptied by at
  // least one full batch are worth the cost.
  const bigDeletes: Array<[string, number]> = [
    ["AdminWorkerLog", out.logRows + out.auditLogRows],
    ["AdminWorkerActionScore", out.actionScores],
    ["AdminWorkerBrainCall", out.brainCalls],
    ["AdminWorkerStageOutcome", out.stageOutcomes],
    ["AdminWorkerRepairPlan", out.repairPlans],
    ["AdminWorkerReasoningGraph", out.reasoningGraph],
    ["AdminWorkerCalibrationHistory", out.calibrationHistory],
    ["AdminWorkerStucknessRecord", out.stucknessRecords],
    ["PostPublishVerification", out.postPublishVerifications],
    ["AdminWorkerDecision", out.decisions],
    ["AdminWorkerPass", out.passes],
  ];
  out.vacuumed = await vacuumLedgerTables(
    prisma,
    bigDeletes.filter(([, n]) => n >= LEDGER_PRUNE_BATCH).map(([t]) => t),
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
