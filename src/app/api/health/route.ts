import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  checkMigrationsApplied,
  checkRequiredTables,
  checkSeedContent,
  probePublicContentTables,
} from "@/lib/db/tables";
import { appConfig } from "@/lib/config";
import { isEmailConfigured } from "@/lib/email/resend";
import { logger } from "@/lib/observability/logger";

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

/**
 * Readiness / diagnostic endpoint. Unlike /api/health/live (the liveness
 * probe), this endpoint actually exercises the database, the migration
 * history table, every required app table, and a representative read on
 * each public content table. A missing column or a busted enum cast that
 * would 500 a real page request shows up here as a `degraded` status.
 *
 * The deploy probe (`/api/health/live`) deliberately does NOT call this —
 * a transient DB blip during boot must not flip the deploy red. Monitoring
 * (PagerDuty, uptime checks, etc.) should hit /api/health.
 */
export async function GET() {
  const db = await checkDatabase();

  if (!db.ok) {
    logger.error("health.db_unreachable", { error: db.error });
    return NextResponse.json(
      {
        status: "unavailable",
        service: "viafidei-web",
        timestamp: Date.now(),
        checks: {
          database: db,
          migrations: { ok: false, error: "database unreachable" },
          tables: { ok: false, error: "database unreachable" },
          contentProbe: { ok: false, error: "database unreachable" },
          seed: { ok: false },
        },
      },
      { status: 503 },
    );
  }

  const [migrations, tables, seed, contentProbe] = await Promise.all([
    checkMigrationsApplied().catch((e: unknown) => ({
      ok: false as const,
      reason: "query_failed" as const,
      detail: e instanceof Error ? e.message : "unknown",
    })),
    checkRequiredTables().catch((e: unknown) => ({
      ok: false,
      missing: [] as string[],
      present: [] as string[],
      publicContentMissing: [] as string[],
      columnsMissing: [] as Array<{ table: string; columns: string[] }>,
      error: e instanceof Error ? e.message : "unknown",
    })),
    checkSeedContent().catch((e: unknown) => ({
      ok: false,
      counts: {} as Record<string, number>,
      error: e instanceof Error ? e.message : "unknown",
    })),
    probePublicContentTables().catch((e: unknown) => ({
      ok: false,
      failures: [] as Array<{ table: string; error: string }>,
      error: e instanceof Error ? e.message : "unknown",
    })),
  ]);

  // Public content tables drive every public page; if any of them are gone
  // or unreadable, every public-facing page will 500. Surface that as its
  // own status so an ops alert can fire on the right symptom.
  const publicContentOk = (tables.publicContentMissing ?? []).length === 0 && contentProbe.ok;
  const columnsOk = (tables.columnsMissing ?? []).length === 0;
  const allOk = db.ok && tables.ok && publicContentOk && columnsOk && migrations.ok && seed.ok;

  const status = allOk
    ? "ok"
    : !migrations.ok
      ? "migration_required"
      : !publicContentOk
        ? "public_content_unavailable"
        : !columnsOk
          ? "columns_missing"
          : tables.missing?.length
            ? "migration_required"
            : !seed.ok
              ? "seed_required"
              : "degraded";

  // 503 when the app is not safe to serve traffic; 200 only when every
  // check passes. /api/health/live stays at 200 either way so the deploy
  // probe is unaffected.
  const httpStatus = allOk ? 200 : 503;

  if (!allOk) {
    logger.warn("health.degraded", {
      status,
      tablesMissing: tables.missing,
      columnsMissing: tables.columnsMissing,
      publicContentMissing: tables.publicContentMissing,
      contentProbeFailures: "failures" in contentProbe ? contentProbe.failures : undefined,
      migrations,
    });
  }

  // Email is intentionally NOT part of `allOk` — a missing RESEND_API_KEY
  // makes account email skip cleanly rather than fail, so the deployment
  // can still serve traffic. We still surface the status so the operator
  // knows whether the welcome / password-reset / verification emails will
  // actually leave the server.
  const emailConfigured = isEmailConfigured();

  return NextResponse.json(
    {
      status,
      service: "viafidei-web",
      timestamp: Date.now(),
      checks: {
        database: db,
        migrations,
        tables,
        contentProbe,
        seed,
        email: {
          configured: emailConfigured,
          fromAddress: appConfig.email.fromAddress,
          provider: appConfig.email.providerName,
        },
      },
    },
    { status: httpStatus },
  );
}
