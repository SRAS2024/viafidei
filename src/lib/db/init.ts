import { prisma } from "./client";
import { checkRequiredTables } from "./tables";

export type InitResult =
  | { ok: true }
  | { ok: false; reason: "tables_missing"; missing: string[] }
  | { ok: false; reason: "db_unreachable"; error: string };

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

  const tableCheck = await checkRequiredTables().catch((e: unknown) => ({
    ok: false,
    missing: [] as string[],
    present: [] as string[],
    error: e instanceof Error ? e.message : "unknown",
  }));

  if (!tableCheck.ok && tableCheck.missing.length > 0) {
    return {
      ok: false,
      reason: "tables_missing",
      missing: tableCheck.missing,
    };
  }

  return { ok: true };
}
