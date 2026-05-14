import { appConfig } from "../config";
import { prisma } from "../db/client";
import { checkRequiredTables } from "../db/tables";
import { logger } from "../observability/logger";
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
 * Run one ingestion tick by POST'ing to the in-process cron route.
 *
 * Why HTTP indirection rather than calling the runner directly: the runner
 * pulls in `node:crypto` (via the advisory-lock module), and if `auto-seed`
 * imported it — even via dynamic import — webpack would trace the
 * dependency chain into the Next.js instrumentation bundle, which has a
 * stricter compile target and refuses `node:` schemes. The HTTP hop keeps
 * that whole subgraph in the regular server bundle.
 *
 * Auth: the cron route accepts (a) a SESSION_SECRET-derived bearer, OR
 * (b) loopback connections from 127.0.0.1 / ::1 — which is what this
 * fetch produces. The loopback fallback means the auto-fill flow works
 * on deployments that haven't configured SESSION_SECRET; the route is
 * still locked down to outside callers (they would need the bearer).
 */
async function runIngestionTick(): Promise<void> {
  const startedAt = Date.now();
  const url = `http://127.0.0.1:${appConfig.port}/api/cron/ingest`;
  try {
    const headers: Record<string, string> = {};
    try {
      const { deriveCronSecret } = await import("../security/cron-auth");
      const secret = await deriveCronSecret();
      if (secret) headers.authorization = `Bearer ${secret}`;
    } catch {
      // No SESSION_SECRET configured — the loopback fallback in the cron
      // route will accept this request because it comes from 127.0.0.1.
    }
    const res = await fetch(url, { method: "POST", headers });
    if (res.ok) {
      logger.info("scheduler ingestion tick ok", {
        durationMs: Date.now() - startedAt,
        status: res.status,
      });
    } else {
      logger.warn("scheduler ingestion tick non-2xx", {
        status: res.status,
        durationMs: Date.now() - startedAt,
      });
    }
  } catch (e) {
    logger.error("scheduler ingestion tick failed", { error: e });
  }
}

/**
 * Quick predicate used by the scheduler tick to decide between burst
 * mode (constant fill) and maintenance mode. Mirrors the shape of
 * getBacklogProgress() in the scheduler module but is inlined here so
 * we don't have to import the ingestion subgraph into auto-seed (that
 * pulls node:crypto into the instrumentation bundle and breaks the
 * build — see the earlier build-fix commit).
 */
async function backlogMet(): Promise<boolean> {
  try {
    const { targets } = appConfig.ingestion;
    const churchDocPrefixes = [
      "encyclical-",
      "catechism-",
      "code-of-canon-law-",
      "code-of-canons-of-the-eastern-churches",
      "council-",
      "vatican-council-",
      "synod-",
    ];
    const sacramentPrefixes = ["sacrament-"];
    const consecrationPrefixes = ["consecration-"];
    const [prayers, saints, parishes, churchDocuments, sacraments, consecrations] =
      await Promise.all([
        prisma.prayer.count(),
        prisma.saint.count(),
        prisma.parish.count(),
        prisma.liturgyEntry.count({
          where: { OR: churchDocPrefixes.map((p) => ({ slug: { startsWith: p } })) },
        }),
        prisma.spiritualLifeGuide.count({
          where: { OR: sacramentPrefixes.map((p) => ({ slug: { startsWith: p } })) },
        }),
        prisma.spiritualLifeGuide.count({
          where: { OR: consecrationPrefixes.map((p) => ({ slug: { startsWith: p } })) },
        }),
      ]);
    return (
      prayers >= targets.prayers &&
      saints >= targets.saints &&
      parishes >= targets.parishes &&
      churchDocuments >= targets.churchDocuments &&
      sacraments >= targets.sacraments &&
      consecrations >= targets.consecrations
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
    logger.info("scheduler in-process ingestion disabled by config — not scheduling");
    return;
  }

  const baseIntervalMs = appConfig.ingestion.intervalMs;
  const initialDelayMs = appConfig.ingestion.initialDelayMs;
  // While the content library is under target, tick four times faster to
  // fill the database more aggressively (constant mode).
  const burstIntervalMs = Math.max(60_000, Math.floor(baseIntervalMs / 4));
  // Once targets are reached, switch to a twice-weekly maintenance check.
  const maintenanceIntervalMs = appConfig.ingestion.maintenanceIntervalMs;

  logger.info("scheduler background ingestion scheduled", {
    initialDelayS: Math.round(initialDelayMs / 1000),
    burstIntervalS: Math.round(burstIntervalMs / 1000),
    maintenanceIntervalH: Math.round(maintenanceIntervalMs / 3_600_000),
  });

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
    logger.warn(
      "startup email disabled — neither RESEND_API_KEY nor RESEND is set; welcome / password-reset / verification emails will be skipped (set the env var in your hosting dashboard and redeploy to enable)",
    );
    return;
  }
  logger.info("startup email configured", {
    provider: appConfig.email.providerName,
    from: appConfig.email.fromAddress,
    apiKeyPrefix: apiKey.slice(0, 4),
    apiKeyLength: apiKey.length,
  });
}

export async function runStartupTasks(): Promise<void> {
  // Brief delay so migrations (run before node server.js) finish committing
  await new Promise((r) => setTimeout(r, 2000));

  await logEmailPipelineStatus();

  if (!(await isDbReachable())) {
    logger.warn("startup DB unreachable — skipping seed and ingestion schedule");
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
      logger.warn("startup account email tables auto-created (migration was missing)", {
        created: result.created,
      });
    } else if (!result.ok) {
      logger.error(
        "startup could not ensure account email tables — welcome / verify / forgot-password flows may fail",
        { message: result.message ?? "unknown error" },
      );
    }
  } catch (e) {
    logger.error("startup ensureAccountEmailTables threw", { error: e });
  }

  const tableCheck = await checkRequiredTables().catch(() => ({
    ok: false,
    missing: ["unknown"] as string[],
    present: [] as string[],
    publicContentMissing: [] as string[],
    columnsMissing: [] as Array<{ table: string; columns: string[] }>,
  }));
  if (!tableCheck.ok) {
    logger.error(
      "startup required tables missing — ensure 'prisma migrate deploy' ran before starting the server",
      {
        missing: tableCheck.missing,
        columnsMissing: tableCheck.columnsMissing,
      },
    );
    return;
  }

  // Run the seeder on EVERY boot. The previous guard
  // (`hasEmptyContentTable`) short-circuited the seed as soon as any
  // public table had a single row, which meant new seed entries
  // shipped in later deploys (encyclicals, CCC sections, Canon Law
  // books, sacraments, rite-history) silently never landed in the DB.
  //
  // The seeder is fully idempotent — every entry is an upsert keyed
  // on `slug`, the `update` clause only forces `status: PUBLISHED`,
  // and the `create` clause only fires for missing rows. Running it
  // every boot has zero data impact on populated tables and back-fills
  // any new content the codebase has added since the last deploy.
  try {
    const summary = await seedAllContent();
    logger.info("startup seed complete", { summary });
  } catch (e) {
    logger.error("startup seed failed", { error: e });
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
      logger.info("startup promoted legacy ingestion orphans to PUBLISHED", {
        promoted,
      });
    }
  } catch (e) {
    logger.error("startup failed to promote ingestion orphans", { error: e });
  }

  scheduleIngestion();
}
