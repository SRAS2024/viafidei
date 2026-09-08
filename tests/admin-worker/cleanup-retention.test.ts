/**
 * Cleanup custodian guarantees:
 *   - reviews the post-publish rollback filed after UNPUBLISHING content are
 *     never aged out to EXPIRED (they are the only open signal for that
 *     hidden content);
 *   - AdminWorkerGrowthSnapshot is trimmed to the newest 30 rows per content
 *     type (the orchestrator wrote 15 rows per run with no retention);
 *   - a client/mock without the snapshot model degrades to "trimmed 0";
 *   - the append-only bookkeeping ledgers are pruned on a hard retention
 *     (INFO logs / action scores / brain calls / decisions / passes 14d, stage
 *     outcomes and terminal repair plans 30d), in bounded batches, at most once
 *     an hour, and NEVER touching WARN/ERROR logs or any content table;
 *   - the tables the post-mortem named are covered, including the three only
 *     the OPERATOR script trimmed (AdminWorkerReasoningGraph 1,976,739 rows,
 *     AdminWorkerCalibrationHistory 1,548,893, AdminWorkerStucknessRecord
 *     207,830) and PostPublishVerification;
 *   - WARN/ERROR log rows have a long but FINITE window, not none at all;
 *   - a prune that emptied a relation by a full batch follows with a plain
 *     VACUUM, because deleting rows alone never returned any disk in
 *     production, and never a VACUUM FULL (an operator action);
 *   - the three tables the first version MISSED are covered: on 2026-09-07 the
 *     production database was 21 GB, of which AdminWorkerDecision was 5.7 GB,
 *     AdminWorkerPass 440 MB and AdminWorkerRepairPlan 27 MB — against 12 MB of
 *     PublishedContent;
 *   - children are deleted BEFORE AdminWorkerPass, whose five inbound foreign
 *     keys are ON DELETE SET NULL (same rationale as the operator script).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ACTION_SCORE_RETENTION_MS,
  BRAIN_CALL_RETENTION_MS,
  CALIBRATION_RETENTION_MS,
  DECISION_RETENTION_MS,
  LEDGER_PRUNE_MAX_BATCHES,
  LOG_AUDIT_RETENTION_MS,
  LOG_INFO_RETENTION_MS,
  PASS_RETENTION_MS,
  POST_PUBLISH_VERIFICATION_RETENTION_MS,
  pruneLedgerRows,
  REASONING_GRAPH_RETENTION_MS,
  REPAIR_PLAN_RETENTION_MS,
  ROLLBACK_REVIEW_ACTIONS,
  runCleanupPass,
  STAGE_OUTCOME_RETENTION_MS,
  STUCKNESS_RETENTION_MS,
  totalLedgerRowsPruned,
  VACUUMABLE_TABLES,
  vacuumLedgerTables,
} from "@/lib/admin-worker/cleanup";

function makePrisma(opts: { snapshotCounts?: Record<string, number> } = {}) {
  const reviewUpdateManyArgs: Array<{ where: Record<string, unknown> }> = [];
  const deleted: string[][] = [];
  const counts = opts.snapshotCounts;
  const prisma = {
    candidateSourceUrl: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      findMany: vi.fn(async () => []),
    },
    adminWorkerSourceRead: { updateMany: vi.fn(async () => ({ count: 0 })) },
    humanReviewQueue: {
      updateMany: vi.fn(async (arg: { where: Record<string, unknown> }) => {
        reviewUpdateManyArgs.push(arg);
        return { count: 0 };
      }),
    },
    adminWorkerLog: { create: vi.fn(async () => ({})) },
    ...(counts
      ? {
          adminWorkerGrowthSnapshot: {
            groupBy: vi.fn(async () =>
              Object.entries(counts).map(([contentType, n]) => ({
                contentType,
                _count: { _all: n },
              })),
            ),
            findMany: vi.fn(
              async (arg: { where: { contentType: string }; skip: number; orderBy: unknown }) => {
                const n = counts[arg.where.contentType];
                expect(arg.orderBy).toEqual({ createdAt: "desc" });
                return Array.from({ length: Math.max(0, n - arg.skip) }, (_, i) => ({
                  id: `${arg.where.contentType}-${arg.skip + i}`,
                }));
              },
            ),
            deleteMany: vi.fn(async (arg: { where: { id: { in: string[] } } }) => {
              deleted.push(arg.where.id.in);
              return { count: arg.where.id.in.length };
            }),
          },
        }
      : {}),
  };
  return { prisma, reviewUpdateManyArgs, deleted };
}

describe("runCleanupPass", () => {
  it("never expires rollback / unpublish reviews", async () => {
    const { prisma, reviewUpdateManyArgs } = makePrisma();
    await runCleanupPass(prisma as never);
    expect(reviewUpdateManyArgs).toHaveLength(1);
    const where = reviewUpdateManyArgs[0].where as {
      status: string;
      proposedAction: { notIn: string[] };
    };
    expect(where.status).toBe("PENDING");
    expect(where.proposedAction.notIn).toEqual([...ROLLBACK_REVIEW_ACTIONS]);
    expect(ROLLBACK_REVIEW_ACTIONS).toContain("restore_or_delete_unpublished_content");
    expect(ROLLBACK_REVIEW_ACTIONS).toContain("investigate_post_publish_failure");
  });

  it("keeps only the newest 30 growth snapshots per content type", async () => {
    const { prisma, deleted } = makePrisma({
      snapshotCounts: { SAINT: 45, PRAYER: 30, PARISH: 12 },
    });
    const out = await runCleanupPass(prisma as never);
    // SAINT: 45 - 30 = 15 trimmed; PRAYER exactly at the limit and PARISH below → untouched.
    expect(out.growthSnapshotsTrimmed).toBe(15);
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toHaveLength(15);
    expect(deleted[0][0]).toBe("SAINT-30");
  });

  it("degrades to 0 trimmed when the snapshot model is unavailable", async () => {
    const { prisma } = makePrisma();
    const out = await runCleanupPass(prisma as never);
    expect(out.growthSnapshotsTrimmed).toBe(0);
  });
});

/**
 * A client whose `$executeRaw` records the statement text and the interpolated
 * values, and reports `rowsPerCall` deletions per call (so batching is
 * observable). Called as a tagged template, exactly as cleanup.ts calls it.
 */
function makeRawPrisma(rowsPerCall: number[] = []) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const unsafe: string[] = [];
  let i = 0;
  const prisma = {
    $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ sql: strings.join("?"), values });
      const n = rowsPerCall[i] ?? 0;
      i += 1;
      return n;
    }),
    $executeRawUnsafe: vi.fn(async (sql: string) => {
      unsafe.push(sql);
      return 0;
    }),
  };
  return { prisma, calls, unsafe };
}

const HOUR = 60 * 60 * 1000;

describe("pruneLedgerRows", () => {
  it("prunes every bookkeeping ledger, children before the parent pass", async () => {
    const { prisma, calls } = makeRawPrisma();
    const out = await pruneLedgerRows(prisma as never, { force: true });
    expect(out.ran).toBe(true);
    const tables = calls.map((c) => c.sql.match(/DELETE FROM "(\w+)"/)?.[1]);
    expect(tables).toEqual([
      "AdminWorkerLog", // INFO, short window
      "AdminWorkerLog", // WARN/ERROR, long window
      "AdminWorkerActionScore",
      "AdminWorkerBrainCall",
      "AdminWorkerStageOutcome",
      "AdminWorkerRepairPlan",
      // The three the post-mortem named that only the OPERATOR script covered —
      // 1,976,739 + 1,548,893 + 207,830 rows in production — plus the
      // verification ledger the post-publish stage appends to every dispatch.
      "AdminWorkerReasoningGraph",
      "AdminWorkerCalibrationHistory",
      "AdminWorkerStucknessRecord",
      "PostPublishVerification",
      "AdminWorkerDecision",
      // LAST: five inbound FKs are ON DELETE SET NULL, so trimming the parent
      // first would rewrite millions of child rows for nothing.
      "AdminWorkerPass",
    ]);
    // The audit trail escalation reads back is trimmed on a LONG window, never
    // the short INFO one — but "never" was itself an unbounded growth channel.
    expect(calls[0].sql).toContain(`"severity" = 'INFO'`);
    expect(calls[1].sql).toContain(`"severity" <> 'INFO'`);
    expect(LOG_AUDIT_RETENTION_MS).toBeGreaterThan(LOG_INFO_RETENTION_MS);
    // A live pass and a live repair plan are never deleted out from under work
    // in flight.
    const passSql = calls.find((c) => c.sql.includes('FROM "AdminWorkerPass"'))!.sql;
    expect(passSql).toContain(`"status" <> 'RUNNING'`);
    const planSql = calls.find((c) => c.sql.includes('FROM "AdminWorkerRepairPlan"'))!.sql;
    expect(planSql).toContain("'SUCCEEDED', 'FAILED', 'ABANDONED'");
    for (const call of calls) {
      expect(call.sql).toContain('WHERE "id" IN (SELECT "id"');
      expect(call.sql).toContain("LIMIT");
    }
  });

  it("never builds a statement against a content table", async () => {
    const { prisma, calls } = makeRawPrisma();
    await pruneLedgerRows(prisma as never, { force: true });
    for (const call of calls) {
      const table = call.sql.match(/DELETE FROM "(\w+)"/)?.[1] ?? "";
      // Every relation touched is worker telemetry on the declared allow-list.
      expect(VACUUMABLE_TABLES).toContain(table);
      expect(call.sql).not.toContain("PublishedContent");
      expect(call.sql).not.toContain("ChecklistItem");
    }
  });

  it("uses the declared retention windows", async () => {
    const now = Date.UTC(2026, 8, 7, 12, 0, 0);
    const { prisma, calls } = makeRawPrisma();
    await pruneLedgerRows(prisma as never, { force: true, now });
    const cutoffs = calls.map((c) => (c.values[0] as Date).getTime());
    expect(cutoffs[0]).toBe(now - LOG_INFO_RETENTION_MS);
    expect(cutoffs[1]).toBe(now - LOG_AUDIT_RETENTION_MS);
    expect(cutoffs[2]).toBe(now - ACTION_SCORE_RETENTION_MS);
    expect(cutoffs[3]).toBe(now - BRAIN_CALL_RETENTION_MS);
    expect(cutoffs[4]).toBe(now - STAGE_OUTCOME_RETENTION_MS);
    expect(cutoffs[5]).toBe(now - REPAIR_PLAN_RETENTION_MS);
    expect(cutoffs[6]).toBe(now - REASONING_GRAPH_RETENTION_MS);
    expect(cutoffs[7]).toBe(now - CALIBRATION_RETENTION_MS);
    expect(cutoffs[8]).toBe(now - STUCKNESS_RETENTION_MS);
    expect(cutoffs[9]).toBe(now - POST_PUBLISH_VERIFICATION_RETENTION_MS);
    expect(cutoffs[10]).toBe(now - DECISION_RETENTION_MS);
    expect(cutoffs[11]).toBe(now - PASS_RETENTION_MS);
    expect(LOG_INFO_RETENTION_MS).toBe(14 * 24 * HOUR);
    expect(STAGE_OUTCOME_RETENTION_MS).toBe(30 * 24 * HOUR);
    expect(DECISION_RETENTION_MS).toBe(14 * 24 * HOUR);
    expect(PASS_RETENTION_MS).toBe(14 * 24 * HOUR);
  });

  it("keeps batching while a batch comes back full, and stops when it is short", async () => {
    // First table: two full batches then a short one; the rest return 0.
    const { prisma, calls } = makeRawPrisma([5000, 5000, 17]);
    const out = await pruneLedgerRows(prisma as never, { force: true });
    expect(out.logRows).toBe(10_017);
    // 3 calls for the INFO log batch + 1 each for the other eleven statements.
    expect(calls).toHaveLength(14);
    expect(totalLedgerRowsPruned(out)).toBe(10_017);
  });

  it("is throttled to once per hour unless forced", async () => {
    const now = Date.UTC(2026, 8, 7, 12, 0, 0);
    const first = makeRawPrisma();
    expect((await pruneLedgerRows(first.prisma as never, { force: true, now })).ran).toBe(true);
    const soon = makeRawPrisma();
    expect((await pruneLedgerRows(soon.prisma as never, { now: now + 59 * 60_000 })).ran).toBe(
      false,
    );
    expect(soon.calls).toHaveLength(0);
    const later = makeRawPrisma();
    expect((await pruneLedgerRows(later.prisma as never, { now: now + 61 * 60_000 })).ran).toBe(
      true,
    );
  });

  it("VACUUMs the relations it emptied by a full batch — a DELETE alone returns no disk", async () => {
    // THE MEASURED LESSON: deleting 7,096,270 production rows left the database
    // still reporting 12 GB, because a DELETE only marks tuples dead. Months of
    // successful prunes with no VACUUM is how a 21 GB ledger happened.
    const { prisma, unsafe } = makeRawPrisma([5000, 17]);
    const out = await pruneLedgerRows(prisma as never, { force: true });
    expect(out.vacuumed).toEqual(["AdminWorkerLog"]);
    expect(unsafe).toEqual(['VACUUM (ANALYZE) "AdminWorkerLog"']);
    // Never VACUUM FULL: that takes ACCESS EXCLUSIVE and is an operator action.
    for (const sql of unsafe) expect(sql).not.toContain("FULL");
  });

  it("does not VACUUM a relation whose prune deleted next to nothing", async () => {
    const { prisma, unsafe } = makeRawPrisma([17]);
    const out = await pruneLedgerRows(prisma as never, { force: true });
    expect(out.vacuumed).toEqual([]);
    expect(unsafe).toEqual([]);
  });

  it("VACUUM refuses any relation outside the allow-list", async () => {
    const { prisma, unsafe } = makeRawPrisma();
    const done = await vacuumLedgerTables(prisma as never, [
      "PublishedContent",
      'AdminWorkerLog"; DROP TABLE "PublishedContent',
      "AdminWorkerLog",
    ]);
    expect(done).toEqual(["AdminWorkerLog"]);
    expect(unsafe).toEqual(['VACUUM (ANALYZE) "AdminWorkerLog"']);
  });

  it("honours a raised per-table cap so a multi-million-row backlog can drain", async () => {
    // The default 20 x 5,000 = 100,000 rows per table needs 169 productive
    // calls against the measured 16.9 M-row AdminWorkerActionScore backlog.
    const full = Array.from({ length: 60 }, () => 5000);
    const capped = makeRawPrisma(full);
    await pruneLedgerRows(capped.prisma as never, { force: true });
    const infoLogCalls = (c: { sql: string }) => c.sql.includes(`"severity" = 'INFO'`);
    expect(capped.calls.filter(infoLogCalls)).toHaveLength(LEDGER_PRUNE_MAX_BATCHES);

    const raised = makeRawPrisma(full);
    await pruneLedgerRows(raised.prisma as never, { force: true, maxBatches: 50 });
    expect(raised.calls.filter(infoLogCalls)).toHaveLength(50);
  });

  it("fails open on a table that errors, and on a client with no raw SQL", async () => {
    const prisma = {
      $executeRaw: vi.fn(async () => {
        throw new Error('relation "AdminWorkerBrainCall" does not exist');
      }),
    };
    const out = await pruneLedgerRows(prisma as never, { force: true });
    expect(out.ran).toBe(true);
    expect(out.logRows).toBe(0);
    // A mock/legacy client with no $executeRaw is a no-op, not a crash.
    const bare = await pruneLedgerRows({} as never, { force: true });
    expect(bare.ran).toBe(false);
  });
});

describe("the ledger prune actually runs every pass", () => {
  it("is wired into the maint-hygiene lane, not only the CLEANUP mission stage", async () => {
    // The CLEANUP stage only runs when the brain picks it, which can be days
    // apart; the ledgers grow every pass. The lane's own hourly throttle keeps
    // that cheap.
    const { OPS_LANES } = await import("@/lib/admin-worker/worker-lanes");
    const lane = OPS_LANES.find((l) => l.name === "maint-hygiene");
    expect(lane).toBeDefined();
    const src = readFileSync(join(process.cwd(), "src/lib/admin-worker/worker-lanes.ts"), "utf8");
    const body = src.slice(src.indexOf('name: "maint-hygiene"'), src.indexOf('name: "reporting"'));
    expect(body).toContain("pruneLedgerRows");
  });
});
