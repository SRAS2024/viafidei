import { type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/security/cron-auth";
import { pruneExpiredRateLimits } from "@/lib/security/rate-limit";
import { pruneExpiredTokens } from "@/lib/auth";
import { runAllActiveJobs } from "@/lib/ingestion/scheduler";
import { ensureVaticanSchedule } from "@/lib/ingestion/sources";
import { markOverdueGoals } from "@/lib/data/goals";
import {
  archiveDuplicatePrayers,
  cleanupMiscategorisedContent,
  pruneOldAuditLogs,
  pruneOldIngestionRuns,
} from "@/lib/data/cleanup";
import { jsonError, jsonOk } from "@/lib/http";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

// Long-lived cron invocation; allow up to 60s for slow upstreams. Pinning
// to the Node runtime is required because the runner imports node:crypto
// transitively through the Postgres advisory-lock helper — the default
// edge runtime would refuse the build.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  if (!(await isAuthorizedCron(req))) {
    logger.warn("cron.unauthorized", { route: "/api/cron/ingest", requestId });
    return jsonError("unauthorized");
  }
  const started = Date.now();
  await ensureVaticanSchedule();
  const summary = await runAllActiveJobs();
  const [
    prunedRateLimits,
    prunedTokens,
    overdueGoals,
    prunedRuns,
    prunedAudits,
    miscategorised,
    duplicatePrayers,
  ] = await Promise.all([
    pruneExpiredRateLimits(),
    pruneExpiredTokens(),
    markOverdueGoals(),
    pruneOldIngestionRuns(),
    pruneOldAuditLogs(),
    // Sweep through every published content row and archive anything
    // that looks like a TV listing, source byline, newsletter blurb,
    // or one-line stub. Quality-over-quantity gate: it is better to
    // ship fewer correctly-categorised entries than many weak ones.
    cleanupMiscategorisedContent(),
    archiveDuplicatePrayers(),
  ]);
  logger.info("cron.completed", {
    route: "/api/cron/ingest",
    requestId,
    durationMs: Date.now() - started,
    summary,
    prunedRateLimits,
    prunedTokens,
    overdueGoals,
    prunedRuns,
    prunedAudits,
    miscategorisedArchived: miscategorised.totalArchived,
    duplicatePrayersArchived: duplicatePrayers,
  });
  return jsonOk({
    summary,
    prunedRateLimits,
    prunedTokens,
    overdueGoals,
    prunedRuns,
    prunedAudits,
    cleanup: { miscategorised, duplicatePrayers },
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
