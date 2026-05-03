import { prisma } from "../db/client";
import { checkRequiredTables } from "../db/tables";
import { seedAllContent } from "./seeder";

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_INITIAL_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const MIN_INTERVAL_MS = 60_000;

let scheduled = false;

async function isDbReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function hasSeedContent(): Promise<boolean> {
  try {
    const count = await prisma.prayer.count({ where: { status: "PUBLISHED" } });
    return count > 0;
  } catch {
    return false;
  }
}

function readEnvMs(name: string, fallback: number, min = 0): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return parsed;
}

/**
 * Trigger ingestion by calling the existing /api/cron/ingest endpoint over
 * HTTP. This keeps all the heavy crawler / Prisma transaction code on the
 * regular Next.js server bundle (instead of being pulled into the
 * instrumentation bundle, which has a stricter compile target).
 *
 * Requires CRON_SECRET (>=16 chars) to be set; otherwise scheduling is a
 * no-op and operators must call /api/cron/ingest from an external scheduler.
 */
async function callIngestionEndpoint(): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    console.warn(
      "[scheduler] CRON_SECRET unset or <16 chars — skipping in-process ingestion (configure an external cron to POST /api/cron/ingest with the bearer token)",
    );
    return;
  }
  const port = process.env.PORT ?? "3000";
  const url = `http://127.0.0.1:${port}/api/cron/ingest`;
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

  if (process.env.INGESTION_DISABLED === "true") {
    console.log("[scheduler] INGESTION_DISABLED=true — not scheduling background ingestion");
    return;
  }

  const intervalMs = readEnvMs("INGESTION_INTERVAL_MS", DEFAULT_INTERVAL_MS, MIN_INTERVAL_MS);
  const initialDelayMs = readEnvMs("INGESTION_INITIAL_DELAY_MS", DEFAULT_INITIAL_DELAY_MS);

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
  }));
  if (!tableCheck.ok) {
    console.error(
      "[startup] required tables missing:",
      tableCheck.missing,
      "— ensure 'prisma migrate deploy' ran before starting the server",
    );
    return;
  }

  if (!(await hasSeedContent())) {
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
