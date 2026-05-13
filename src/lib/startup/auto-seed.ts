import { appConfig } from "../config";
import { prisma } from "../db/client";
import { checkRequiredTables } from "../db/tables";
import { ensureAccountEmailTables } from "./ensure-email-tables";
import { promoteIngestedOrphans } from "./promote-ingested";
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
 * Run one ingestion tick directly in-process.
 *
 * Calling the registry → runner pipeline directly (rather than POST'ing
 * to /api/cron/ingest) means the auto-fill flow works in deployments that
 * have not configured a SESSION_SECRET — the HTTP indirection would
 * otherwise fail at the cron-auth gate and the catalog would never grow.
 * The crawler + Prisma + http-client modules are already loaded by the
 * time the scheduler runs, so there is no bundle-size penalty either.
 */
async function runIngestionTick(): Promise<void> {
  const startedAt = Date.now();
  try {
    const [{ ensureVaticanSchedule }, { runAllActiveJobs }, { getBacklogProgress }] =
      await Promise.all([
        import("../ingestion/sources/bootstrap"),
        import("../ingestion/scheduler"),
        import("../ingestion/scheduler"),
      ]);
    await ensureVaticanSchedule();
    const summary = await runAllActiveJobs();
    const totals = summary.runs.reduce(
      (acc, r) => {
        acc.seen += r.summary.recordsSeen;
        acc.created += r.summary.recordsCreated;
        acc.updated += r.summary.recordsUpdated;
        acc.skipped += r.summary.recordsSkipped;
        acc.failed += r.summary.recordsFailed;
        return acc;
      },
      { seen: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
    );
    const progress = await getBacklogProgress().catch(() => null);
    console.log(
      "[scheduler] ingestion tick ok",
      JSON.stringify({
        durationMs: Date.now() - startedAt,
        ...totals,
        backlog: progress
          ? { mode: progress.mode, counts: progress.counts, targets: progress.targets }
          : undefined,
      }),
    );
  } catch (e) {
    console.error("[scheduler] ingestion tick failed", e instanceof Error ? e.message : e);
  }
}

async function backlogMet(): Promise<boolean> {
  try {
    const { targets } = appConfig.ingestion;
    const [prayers, saints, parishes] = await Promise.all([
      prisma.prayer.count(),
      prisma.saint.count(),
      prisma.parish.count(),
    ]);
    return (
      prayers >= targets.prayers && saints >= targets.saints && parishes >= targets.parishes
    );
  } catch {
    return true;
  }
}

/**
 * Schedules background ingestion in two modes:
 *
 *   - `constant`   — at least one of the prayer / saint / parish targets is
 *     unmet. The scheduler ticks aggressively (burst interval) so the
 *     content library fills up without requiring manual uploads.
 *
 *   - `maintenance` — all minimums have been reached. The scheduler drops
 *     to twice-weekly so the catalog stays fresh without unnecessary
 *     background activity. Each tick still runs every active job — they
 *     internally short-circuit on ETag/Last-Modified responses and the
 *     dedup pass discards anything already on file.
 */
function scheduleIngestion(): void {
  if (scheduled) return;
  scheduled = true;

  if (appConfig.ingestion.schedulerDisabled) {
    console.log("[scheduler] in-process ingestion disabled by config — not scheduling");
    return;
  }

  const baseIntervalMs = appConfig.ingestion.intervalMs;
  const initialDelayMs = appConfig.ingestion.initialDelayMs;
  // While the content library is under target, tick four times faster to
  // fill the database more aggressively (constant mode).
  const burstIntervalMs = Math.max(60_000, Math.floor(baseIntervalMs / 4));
  // Once targets are reached, switch to a twice-weekly maintenance check.
  const maintenanceIntervalMs = appConfig.ingestion.maintenanceIntervalMs;

  console.log(
    `[scheduler] background ingestion scheduled — initial ${Math.round(initialDelayMs / 1000)}s, constant-mode interval ${Math.round(burstIntervalMs / 1000)}s, maintenance-mode interval ${Math.round(maintenanceIntervalMs / 3_600_000)}h (≈twice weekly)`,
  );

  let currentTimer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    await runIngestionTick();
    const met = await backlogMet();
    const next = met ? maintenanceIntervalMs : burstIntervalMs;
    currentTimer = setTimeout(tick, next);
    if (typeof currentTimer.unref === "function") currentTimer.unref();
  };

  // Kick off the first tick after a short warm-up so migrations and the
  // seeder finish first, then keep ticking. We deliberately do NOT wait
  // for an external cron pulse — the in-process scheduler is the
  // primary driver while the catalog is below target.
  const firstDelayMs = (async () => {
    try {
      return (await backlogMet()) ? maintenanceIntervalMs : initialDelayMs;
    } catch {
      return initialDelayMs;
    }
  })();
  void firstDelayMs.then((ms) => {
    const initialTimer = setTimeout(() => {
      void tick();
    }, ms);
    if (typeof initialTimer.unref === "function") initialTimer.unref();
  });
}

/**
 * Tell the operator at startup whether transactional email is configured.
 * Without a Resend API key, every welcome / password-reset / verification
 * send is silently skipped — the user-facing flow still succeeds, but no
 * message ever leaves the server. Surfacing the configuration state in
 * the deployment log lets the operator catch the missing key without
 * having to read code or hit the admin diagnostic page.
 *
 * Resolves the key through the same helper the runtime sender uses, so a
 * deployment that has set either `RESEND_API_KEY` or `RESEND` is reported
 * the same way.
 */
async function logEmailPipelineStatus(): Promise<void> {
  // Dynamic import so this startup helper stays decoupled from the email
  // module's load order; auto-seed runs in instrumentation, which Next
  // boots before request handlers.
  const { readResendApiKey } = await import("../email/resend");
  const apiKey = readResendApiKey();
  if (apiKey === null) {
    console.warn(
      "[startup] EMAIL DISABLED — neither RESEND_API_KEY nor RESEND is set; welcome / password-reset / verification emails will be skipped (set the env var in your hosting dashboard and redeploy to enable)",
    );
    return;
  }
  console.log(
    `[startup] email configured — provider=${appConfig.email.providerName} from=${appConfig.email.fromAddress} apiKey=${apiKey.slice(0, 4)}…(${apiKey.length} chars)`,
  );
}

export async function runStartupTasks(): Promise<void> {
  // Brief delay so migrations (run before node server.js) finish committing
  await new Promise((r) => setTimeout(r, 2000));

  await logEmailPipelineStatus();

  if (!(await isDbReachable())) {
    console.warn("[startup] DB unreachable — skipping seed and ingestion schedule");
    return;
  }

  // Belt-and-suspenders for the account email contract. The proper
  // fix is `prisma migrate deploy` (which scripts/start.sh runs before
  // node server.js), but if that pipeline is bypassed for any reason
  // the welcome / verify / forgot-password flows would silently fail
  // on the first token write. Run the same idempotent SQL the
  // 0006 migration runs so missing tables are created in-process. No-op
  // on a healthy database — every statement is `IF NOT EXISTS`.
  try {
    const result = await ensureAccountEmailTables();
    if (result.ok && result.created.length > 0) {
      console.warn(
        `[startup] account email tables auto-created (migration was missing): ${result.created.join(", ")}`,
      );
    } else if (!result.ok) {
      console.error(
        `[startup] could not ensure account email tables — welcome / verify / forgot-password flows may fail: ${result.message ?? "unknown error"}`,
      );
    }
  } catch (e) {
    console.error(
      "[startup] ensureAccountEmailTables threw",
      e instanceof Error ? e.message : String(e),
    );
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

  // Promote any auto-ingested rows that are still stuck in REVIEW status
  // from previous deploys (when the default initial status was REVIEW).
  // Now that ingestion auto-publishes, those orphans should be visible to
  // public users instead of sitting in a moderation queue indefinitely.
  // Admin-set DRAFT / ARCHIVED rows are intentionally untouched.
  try {
    const promoted = await promoteIngestedOrphans();
    const total = Object.values(promoted).reduce((a, b) => a + b, 0);
    if (total > 0) {
      console.log(
        "[startup] promoted legacy ingestion orphans to PUBLISHED",
        JSON.stringify(promoted),
      );
    }
  } catch (e) {
    console.error(
      "[startup] failed to promote ingestion orphans",
      e instanceof Error ? e.message : e,
    );
  }

  scheduleIngestion();
}
