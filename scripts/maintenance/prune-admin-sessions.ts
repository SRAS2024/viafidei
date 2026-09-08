#!/usr/bin/env tsx
/**
 * Delete dead rows from the interactive admin session store.
 *
 * WHY IT LIVES HERE AND NOT IN THE ADMIN WORKER
 * ---------------------------------------------
 * `AdminSession` accumulates rows: every sign-in writes a PENDING row, the
 * second factor rotates it into a second row, and both are kept for
 * `ADMIN_SESSION_RETENTION_MS` (7 days) after they die because "was this
 * session still alive when the breach happened?" is a question an incident
 * review has to be able to answer. After the retention window they are just
 * dead weight, so something has to sweep them.
 *
 * The obvious home would be the Admin Worker's cleanup lane, and that is
 * exactly the wrong place. `tests/security/fail-closed.test.ts` pins that NO
 * module under `src/lib/admin-worker/**` imports `lib/auth/admin-session` —
 * structural isolation (spec item 12) that keeps the worker out of
 * interactive admin authentication entirely. Wiring the sweep into the lane
 * would create that import and trade a real security property for a cron
 * slot. So the sweep runs from here instead: an operator command, outside the
 * worker tree, importing the store directly.
 *
 * The alternative considered was an opportunistic sweep at the admin-auth
 * entry point. Rejected: it would put a DELETE on the hot authorization path,
 * make cleanup timing depend on admin traffic, and give an authentication
 * function a second, unrelated job. A maintenance command that does one thing
 * is the less surprising design.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * There is no second implementation of the delete. The bounded, batched,
 * never-throwing `pruneExpiredAdminSessions` in the store is the only one;
 * this script drives it and reports. It touches no table but `AdminSession`,
 * and it deletes nothing unless `--confirm` is passed.
 *
 * Usage:
 *   npx tsx scripts/maintenance/prune-admin-sessions.ts             # dry run
 *   npx tsx scripts/maintenance/prune-admin-sessions.ts --confirm
 *   npx tsx scripts/maintenance/prune-admin-sessions.ts --confirm --batch 1000
 *
 * DATABASE_URL selects the target — the same rule as every other maintenance
 * script. No credential is ever taken on the command line.
 */
import { Prisma } from "@prisma/client";

import {
  ADMIN_SESSION_RETENTION_MS,
  pruneExpiredAdminSessions,
  type RawQueryClient,
} from "../../src/lib/auth/admin-session";

/** Safety ceiling on one run, so an operator cannot start an unbounded loop. */
const MAX_BATCHES = 200;

export type PruneAdminSessionsOptions = {
  client: RawQueryClient;
  /** Nothing is deleted unless this is true. */
  confirm?: boolean;
  /** Rows per batch; the store clamps this to 1..5000. */
  batch?: number;
  now?: Date;
  log?: (line: string) => void;
};

export type PruneAdminSessionsResult = {
  /** Rows older than the retention window at the moment the run started. */
  eligible: number;
  /** Rows actually deleted (always 0 on a dry run). */
  deleted: number;
  confirmed: boolean;
  /** True when the batch ceiling stopped the run before the table was clean. */
  truncated: boolean;
  cutoff: Date;
};

/** Count the rows the sweep is allowed to remove. Read-only. */
async function countEligible(client: RawQueryClient, cutoff: Date): Promise<number> {
  const rows = await client.$queryRaw(Prisma.sql`
    SELECT count(*)::int AS n
      FROM "AdminSession"
     WHERE "absoluteExpiresAt" < ${cutoff}
        OR ("revokedAt" IS NOT NULL AND "revokedAt" < ${cutoff})
  `);
  if (!Array.isArray(rows)) return 0;
  const n = (rows[0] as { n?: unknown } | undefined)?.n;
  return typeof n === "number" ? n : Number(n ?? 0);
}

/**
 * Run the sweep. Exported so the test suite can drive it against a stub
 * client — the script body below is only argument parsing.
 */
export async function pruneAdminSessions(
  options: PruneAdminSessionsOptions,
): Promise<PruneAdminSessionsResult> {
  const { client, confirm = false, batch = 500 } = options;
  const now = options.now ?? new Date();
  const log = options.log ?? ((line: string) => console.log(line));
  const cutoff = new Date(now.getTime() - ADMIN_SESSION_RETENTION_MS);

  const eligible = await countEligible(client, cutoff);
  log(`AdminSession rows dead since before ${cutoff.toISOString()}: ${eligible}`);
  log(confirm ? "MODE: deleting" : "MODE: dry run (pass --confirm to delete)");

  if (!confirm) {
    return { eligible, deleted: 0, confirmed: false, truncated: false, cutoff };
  }

  let deleted = 0;
  let batches = 0;
  for (;;) {
    // Bounded and non-throwing by construction — see the store. A batch that
    // returns 0 means the table is clean (or the store reported a failure and
    // returned 0, which also ends the run rather than spinning).
    const removed = await pruneExpiredAdminSessions({ now, limit: batch, client });
    if (removed === 0) break;
    deleted += removed;
    batches += 1;
    log(`  deleted ${deleted}`);
    if (batches >= MAX_BATCHES) {
      log(`stopping at the ${MAX_BATCHES}-batch ceiling — run again to continue`);
      return { eligible, deleted, confirmed: true, truncated: true, cutoff };
    }
  }
  log(`deleted ${deleted} dead admin session rows`);
  return { eligible, deleted, confirmed: true, truncated: false, cutoff };
}

function parseBatch(argv: string[]): number | undefined {
  const idx = argv.indexOf("--batch");
  if (idx === -1) return undefined;
  const value = Number(argv[idx + 1]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

async function main(): Promise<void> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await pruneAdminSessions({
      client: prisma,
      confirm: process.argv.includes("--confirm"),
      batch: parseBatch(process.argv),
    });
  } finally {
    await prisma.$disconnect();
  }
}

// Only run when an operator invoked this file directly. Importing it (from
// the test suite, or from another script) must not delete anything.
if (/prune-admin-sessions\.ts$/.test(process.argv[1] ?? "")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
