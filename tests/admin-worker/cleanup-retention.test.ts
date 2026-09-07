/**
 * Cleanup custodian guarantees:
 *   - reviews the post-publish rollback filed after UNPUBLISHING content are
 *     never aged out to EXPIRED (they are the only open signal for that
 *     hidden content);
 *   - AdminWorkerGrowthSnapshot is trimmed to the newest 30 rows per content
 *     type (the orchestrator wrote 15 rows per run with no retention);
 *   - a client/mock without the snapshot model degrades to "trimmed 0";
 *   - the append-only bookkeeping ledgers are pruned on a hard retention
 *     (INFO logs / action scores / brain calls 14d, stage outcomes 30d), in
 *     bounded batches, at most once an hour, and NEVER touching WARN/ERROR
 *     logs, decisions, passes or any content table.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ACTION_SCORE_RETENTION_MS,
  BRAIN_CALL_RETENTION_MS,
  LOG_INFO_RETENTION_MS,
  pruneLedgerRows,
  ROLLBACK_REVIEW_ACTIONS,
  runCleanupPass,
  STAGE_OUTCOME_RETENTION_MS,
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
  let i = 0;
  const prisma = {
    $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ sql: strings.join("?"), values });
      const n = rowsPerCall[i] ?? 0;
      i += 1;
      return n;
    }),
  };
  return { prisma, calls };
}

const HOUR = 60 * 60 * 1000;

describe("pruneLedgerRows", () => {
  it("prunes exactly the four bookkeeping ledgers, and only INFO logs", async () => {
    const { prisma, calls } = makeRawPrisma();
    const out = await pruneLedgerRows(prisma as never, { force: true });
    expect(out.ran).toBe(true);
    const tables = calls.map((c) => c.sql.match(/DELETE FROM "(\w+)"/)?.[1]);
    expect(tables).toEqual([
      "AdminWorkerLog",
      "AdminWorkerActionScore",
      "AdminWorkerBrainCall",
      "AdminWorkerStageOutcome",
    ]);
    // WARN/ERROR are the audit trail escalation reads back — never deleted.
    expect(calls[0].sql).toContain(`"severity" = 'INFO'`);
    for (const call of calls) {
      expect(call.sql).toContain('WHERE "id" IN (SELECT "id"');
      expect(call.sql).toContain("LIMIT");
    }
  });

  it("uses the declared retention windows", async () => {
    const now = Date.UTC(2026, 8, 7, 12, 0, 0);
    const { prisma, calls } = makeRawPrisma();
    await pruneLedgerRows(prisma as never, { force: true, now });
    const cutoffs = calls.map((c) => (c.values[0] as Date).getTime());
    expect(cutoffs[0]).toBe(now - LOG_INFO_RETENTION_MS);
    expect(cutoffs[1]).toBe(now - ACTION_SCORE_RETENTION_MS);
    expect(cutoffs[2]).toBe(now - BRAIN_CALL_RETENTION_MS);
    expect(cutoffs[3]).toBe(now - STAGE_OUTCOME_RETENTION_MS);
    expect(LOG_INFO_RETENTION_MS).toBe(14 * 24 * HOUR);
    expect(STAGE_OUTCOME_RETENTION_MS).toBe(30 * 24 * HOUR);
  });

  it("keeps batching while a batch comes back full, and stops when it is short", async () => {
    // First table: two full batches then a short one; the rest return 0.
    const { prisma, calls } = makeRawPrisma([5000, 5000, 17]);
    const out = await pruneLedgerRows(prisma as never, { force: true });
    expect(out.logRows).toBe(10_017);
    // 3 calls for the log table + 1 each for the other three.
    expect(calls).toHaveLength(6);
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
