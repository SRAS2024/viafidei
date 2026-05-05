import { appConfig } from "../config";
import { prisma } from "../db/client";
import { checkRequiredTables } from "../db/tables";
import { seedAllContent } from "./seeder";

let scheduled = false;

async function isDbReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns true when at least one of the public content tables already has a
 * row — telling us the DB is "stocked" enough that we don't need to re-run
 * the bulk seeder. The seeder itself is idempotent (every entry is upserted
 * by slug) so running it again is safe but wastes startup time.
 */
async function hasAnyContent(): Promise<boolean> {
  try {
    const [prayers, saints, devotions, liturgy, guides, apparitions] = await Promise.all([
      prisma.prayer.count(),
      prisma.saint.count(),
      prisma.devotion.count(),
      prisma.liturgyEntry.count(),
      prisma.spiritualLifeGuide.count(),
      prisma.marianApparition.count(),
    ]);
    return prayers + saints + devotions + liturgy + guides + apparitions > 0;
  } catch {
    return false;
  }
}

/**
 * The seeder upserts by slug, so even if some tables are empty and others
 * are populated, the result is consistent: existing rows stay, missing rows
 * get created. We always run the seeder if any required table is empty.
 */
async function hasEmptyContentTable(): Promise<boolean> {
  try {
    const [prayers, saints, devotions, liturgy, guides, apparitions, parishes] = await Promise.all([
      prisma.prayer.count({ where: { status: "PUBLISHED" } }),
      prisma.saint.count({ where: { status: "PUBLISHED" } }),
      prisma.devotion.count({ where: { status: "PUBLISHED" } }),
      prisma.liturgyEntry.count({ where: { status: "PUBLISHED" } }),
      prisma.spiritualLifeGuide.count({ where: { status: "PUBLISHED" } }),
      prisma.marianApparition.count({ where: { status: "PUBLISHED" } }),
      prisma.parish.count({ where: { status: "PUBLISHED" } }),
    ]);
    return [prayers, saints, devotions, liturgy, guides, apparitions, parishes].some(
      (c) => c === 0,
    );
  } catch {
    return false;
  }
}

/**
 * Trigger ingestion by calling the existing /api/cron/ingest endpoint over
 * HTTP. This keeps all the heavy crawler / Prisma transaction code on the
 * regular Next.js server bundle (instead of being pulled into the
 * instrumentation bundle, which has a stricter compile target).
 *
 * Uses a SESSION_SECRET-derived bearer so the cron route is protected
 * without requiring a separate CRON_SECRET deployment variable.
 */
async function callIngestionEndpoint(): Promise<void> {
  const { deriveCronSecret } = await import("../security/cron-auth");
  const secret = await deriveCronSecret();
  if (!secret) {
    console.warn("[scheduler] no SESSION_SECRET available — skipping in-process ingestion tick");
    return;
  }
  const url = `http://127.0.0.1:${appConfig.port}/api/cron/ingest`;
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    if (res.ok) {
      console.log(
        "[scheduler] ingestion tick ok",
        JSON.stringify({ durationMs: Date.now() - startedAt }),
      );
    } else {
      console.warn(
        "[scheduler] ingestion tick non-2xx",
        JSON.stringify({ status: res.status, durationMs: Date.now() - startedAt }),
      );
    }
  } catch (e) {
    console.error("[scheduler] ingestion tick failed", e instanceof Error ? e.message : e);
  }
}

function scheduleIngestion(): void {
  if (scheduled) return;
  scheduled = true;

  if (appConfig.ingestion.schedulerDisabled) {
    console.log("[scheduler] in-process ingestion disabled by config — not scheduling");
    return;
  }

  const intervalMs = appConfig.ingestion.intervalMs;
  const initialDelayMs = appConfig.ingestion.initialDelayMs;

  console.log(
    `[scheduler] background ingestion scheduled — initial ${Math.round(initialDelayMs / 1000)}s, interval ${Math.round(intervalMs / 1000)}s`,
  );

  const initialTimer = setTimeout(() => {
    void callIngestionEndpoint();
    const tickTimer = setInterval(() => {
      void callIngestionEndpoint();
    }, intervalMs);
    if (typeof tickTimer.unref === "function") tickTimer.unref();
  }, initialDelayMs);
  if (typeof initialTimer.unref === "function") initialTimer.unref();
}

export async function runStartupTasks(): Promise<void> {
  // Brief delay so migrations (run before node server.js) finish committing
  await new Promise((r) => setTimeout(r, 2000));

  if (!(await isDbReachable())) {
    console.warn("[startup] DB unreachable — skipping seed and ingestion schedule");
    return;
  }

  const tableCheck = await checkRequiredTables().catch(() => ({
    ok: false,
    missing: ["unknown"] as string[],
    present: [] as string[],
    publicContentMissing: [] as string[],
    columnsMissing: [] as Array<{ table: string; columns: string[] }>,
  }));
  if (!tableCheck.ok) {
    console.error(
      "[startup] required tables missing:",
      tableCheck.missing,
      "columns missing:",
      tableCheck.columnsMissing,
      "— ensure 'prisma migrate deploy' ran before starting the server",
    );
    return;
  }

  // Seed when ANY public content table is empty. The seeder uses upsert
  // keyed on slug so populated tables are unaffected; this just back-fills
  // tables that didn't get content (e.g. deploy ran during a partial seed).
  if (await hasEmptyContentTable()) {
    console.log("[startup] one or more content tables empty — running seeder");
    try {
      const summary = await seedAllContent();
      console.log("[startup] seed complete", JSON.stringify(summary));
    } catch (e) {
      console.error("[startup] seed failed", e instanceof Error ? e.message : e);
    }
  } else if (!(await hasAnyContent())) {
    console.log("[startup] empty DB detected — running initial seed");
    try {
      const summary = await seedAllContent();
      console.log("[startup] seed complete", JSON.stringify(summary));
    } catch (e) {
      console.error("[startup] seed failed", e instanceof Error ? e.message : e);
    }
  } else {
    console.log("[startup] content already present — skipping seed");
  }

  scheduleIngestion();
}
