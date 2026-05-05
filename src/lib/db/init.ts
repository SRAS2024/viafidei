import { prisma } from "./client";
import { checkMigrationsApplied, checkRequiredTables } from "./tables";

export type InitResult =
  | { ok: true }
  | { ok: false; reason: "tables_missing"; missing: string[] }
  | { ok: false; reason: "columns_missing"; tables: Array<{ table: string; columns: string[] }> }
  | { ok: false; reason: "migrations_missing"; detail: string }
  | { ok: false; reason: "db_unreachable"; error: string };

/**
 * Aggregate readiness check used by background jobs (auto-seed, scheduled
 * ingestion) before they touch the database. The web request path uses the
 * /api/health endpoint — both call into the same primitives in tables.ts so
 * the operator sees consistent reasons across the two.
 */
export async function assertDatabaseReady(): Promise<InitResult> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error: unknown) {
    return {
      ok: false,
      reason: "db_unreachable",
      error: error instanceof Error ? error.message : "unknown",
    };
  }

  const migrations = await checkMigrationsApplied();
  if (!migrations.ok) {
    return {
      ok: false,
      reason: "migrations_missing",
      detail: migrations.reason === "table_missing" ? "_prisma_migrations" : migrations.detail,
    };
  }

  const tableCheck = await checkRequiredTables().catch(() => ({
    ok: false,
    missing: [] as string[],
    present: [] as string[],
    publicContentMissing: [] as string[],
    columnsMissing: [] as Array<{ table: string; columns: string[] }>,
  }));

  if (tableCheck.missing.length > 0) {
    return {
      ok: false,
      reason: "tables_missing",
      missing: tableCheck.missing,
    };
  }

  if (tableCheck.columnsMissing.length > 0) {
    return {
      ok: false,
      reason: "columns_missing",
      tables: tableCheck.columnsMissing,
    };
  }

  return { ok: true };
}
