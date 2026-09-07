#!/usr/bin/env tsx
/**
 * Prune the Admin Worker's telemetry ledger and reclaim the disk it holds.
 *
 * Why this exists: between 2026-05 and 2026-08 the worker wrote ~7 million
 * ledger rows while publishing nothing, growing the production database to
 * 21 GB against 12 MB of actual content. The worker now trims itself on a
 * schedule (see src/lib/admin-worker/self-maintenance.ts), but a database
 * that has already blown up needs a one-time compaction, and an operator
 * needs a way to run one deliberately. That is this script.
 *
 * Safety rules, all enforced below rather than by convention:
 *   - TABLES is an exhaustive allow-list of admin-worker telemetry. No
 *     statement is built from anything else, so no content table can be
 *     touched even by a typo.
 *   - Children are trimmed before AdminWorkerPass, whose five inbound
 *     foreign keys are ON DELETE SET NULL: trimming the parent first would
 *     rewrite millions of child rows for nothing.
 *   - Deletes are batched by ctid so each statement takes a short lock
 *     instead of one transaction holding the table for minutes.
 *   - The default is a dry run. Nothing is deleted without --confirm.
 *   - PublishedContent is counted before and after and the script fails
 *     loudly if that count moves.
 *
 * Usage:
 *   npx tsx scripts/maintenance/prune-worker-ledger.ts --railway            # dry run
 *   npx tsx scripts/maintenance/prune-worker-ledger.ts --railway --confirm --vacuum
 *
 * DATABASE_URL selects the target. --railway instead resolves the linked
 * Railway project's public Postgres URL through the same helper the desktop
 * launcher uses, so an operator never has to paste a credential.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

/** Exhaustive allow-list: admin-worker telemetry only, in safe deletion order. */
const TABLES = [
  { table: "AdminWorkerLog", tsCol: "createdAt", keep: 20_000 },
  { table: "AdminWorkerDecision", tsCol: "createdAt", keep: 5_000 },
  { table: "AdminWorkerRepairPlan", tsCol: "createdAt", keep: 2_000 },
  { table: "AdminWorkerPass", tsCol: "startedAt", keep: 5_000 },
] as const;

const BATCH = 25_000;

function ident(name: string): string {
  // Defence in depth: the names are literals above, but never interpolate
  // anything that has not been proven to be a bare identifier.
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) throw new Error(`refusing unsafe identifier: ${name}`);
  return `"${name}"`;
}

/**
 * Resolve the linked Railway project's PUBLIC Postgres URL. The private
 * *.railway.internal host is unreachable from an operator's laptop, and we
 * never want a credential pasted on a command line, so we shell out to the
 * launcher's own resolver and read its single JSON line.
 */
function railwayDatabaseUrl(): string {
  const helper = path.join(__dirname, "..", "desktop-app", "railway-public-db-url.mjs");
  const out = execFileSync(process.execPath, [helper], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const line of out.trim().split("\n")) {
    let parsed: { publicDbUrl?: string; error?: string };
    try {
      parsed = JSON.parse(line) as { publicDbUrl?: string; error?: string };
    } catch {
      continue;
    }
    if (parsed.publicDbUrl) return parsed.publicDbUrl;
    if (parsed.error) throw new Error(`railway resolver: ${parsed.error}`);
  }
  throw new Error(
    "could not resolve the Railway public database URL — run `railway login && railway link` first",
  );
}

async function main(): Promise<void> {
  const confirm = process.argv.includes("--confirm");
  const vacuum = process.argv.includes("--vacuum");
  if (process.argv.includes("--railway")) process.env.DATABASE_URL = railwayDatabaseUrl();
  const prisma = new PrismaClient();

  const [{ s: sizeBefore }] = await prisma.$queryRawUnsafe<Array<{ s: string }>>(
    `SELECT pg_size_pretty(pg_database_size(current_database())) AS s`,
  );
  const [{ n: contentBefore }] = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT count(*)::int AS n FROM "PublishedContent"`,
  );
  console.log(`database size: ${sizeBefore}`);
  console.log(`PublishedContent rows: ${contentBefore} (must not change)`);
  console.log(confirm ? "MODE: deleting" : "MODE: dry run (pass --confirm to delete)");

  let deletedTotal = 0;
  for (const { table, tsCol, keep } of TABLES) {
    const t = ident(table);
    const c = ident(tsCol);
    const cutRows = await prisma.$queryRawUnsafe<Array<{ cut: Date | null }>>(
      `SELECT ${c} AS cut FROM ${t} ORDER BY ${c} DESC OFFSET ${keep} LIMIT 1`,
    );
    const cut = cutRows[0]?.cut ?? null;
    if (!cut) {
      console.log(`${table}: at or below the ${keep}-row floor, nothing to trim`);
      continue;
    }
    const [{ n }] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*)::bigint AS n FROM ${t} WHERE ${c} < $1`,
      cut,
    );
    console.log(`${table}: ${n} rows older than ${cut.toISOString()} (keeping newest ${keep})`);
    if (!confirm) continue;

    let removed = 0;
    for (;;) {
      const batch = await prisma.$executeRawUnsafe(
        `DELETE FROM ${t} WHERE ctid IN (SELECT ctid FROM ${t} WHERE ${c} < $1 LIMIT ${BATCH})`,
        cut,
      );
      if (batch === 0) break;
      removed += batch;
      process.stdout.write(`\r  ${table}: ${removed} deleted`);
    }
    if (removed) process.stdout.write("\n");
    deletedTotal += removed;
  }

  if (confirm && vacuum) {
    console.log("reclaiming disk (VACUUM FULL — brief exclusive lock per table)");
    for (const { table } of TABLES) {
      const started = Date.now();
      await prisma.$executeRawUnsafe(`VACUUM (FULL, ANALYZE) ${ident(table)}`);
      console.log(`  ${table}: ${Math.round((Date.now() - started) / 1000)}s`);
    }
  }

  const [{ n: contentAfter }] = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT count(*)::int AS n FROM "PublishedContent"`,
  );
  const [{ s: sizeAfter }] = await prisma.$queryRawUnsafe<Array<{ s: string }>>(
    `SELECT pg_size_pretty(pg_database_size(current_database())) AS s`,
  );
  console.log(`deleted ${deletedTotal} ledger rows; database ${sizeBefore} -> ${sizeAfter}`);
  console.log(`PublishedContent rows: ${contentAfter}`);
  await prisma.$disconnect();
  if (contentAfter !== contentBefore) {
    throw new Error(
      `PublishedContent changed from ${contentBefore} to ${contentAfter} — investigate immediately`,
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
