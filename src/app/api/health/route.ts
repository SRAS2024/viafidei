import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { checkRequiredTables, checkSeedContent } from "@/lib/db/tables";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEALTH_TIMEOUT_MS = 3000;

async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = Date.now();
  try {
    const ping = prisma.$queryRaw`SELECT 1`;
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("db ping timeout")), HEALTH_TIMEOUT_MS),
    );
    await Promise.race([ping, timeout]);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error: unknown) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "unknown",
    };
  }
}

export async function GET() {
  const db = await checkDatabase();

  if (!db.ok) {
    return NextResponse.json(
      {
        status: "unavailable",
        service: "viafidei-web",
        timestamp: Date.now(),
        checks: {
          database: db,
          tables: { ok: false, error: "database unreachable" },
          seed: { ok: false },
        },
      },
      { status: 503 },
    );
  }

  const [tables, seed] = await Promise.all([
    checkRequiredTables().catch((e: unknown) => ({
      ok: false,
      missing: [] as string[],
      present: [] as string[],
      publicContentMissing: [] as string[],
      error: e instanceof Error ? e.message : "unknown",
    })),
    checkSeedContent().catch((e: unknown) => ({
      ok: false,
      counts: {} as Record<string, number>,
      error: e instanceof Error ? e.message : "unknown",
    })),
  ]);

  // Public content tables are the most important — if any of them are gone,
  // every public-facing page will 500. Surface that as its own status so an
  // ops alert can fire on the right symptom.
  const publicContentOk = (tables.publicContentMissing ?? []).length === 0;
  const allOk = db.ok && tables.ok && publicContentOk;
  const status = allOk
    ? "ok"
    : !publicContentOk
      ? "public_content_unavailable"
      : tables.missing?.length
        ? "migration_required"
        : "degraded";
  const httpStatus = allOk ? 200 : 503;

  return NextResponse.json(
    {
      status,
      service: "viafidei-web",
      timestamp: Date.now(),
      checks: {
        database: db,
        tables,
        seed,
      },
    },
    { status: httpStatus },
  );
}
