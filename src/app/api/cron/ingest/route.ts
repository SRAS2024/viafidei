import { type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/security/cron-auth";
import { pruneExpiredRateLimits } from "@/lib/security/rate-limit";
import { pruneExpiredTokens } from "@/lib/auth";
import { runAllActiveJobs } from "@/lib/ingestion/scheduler";
import { ensureVaticanSchedule } from "@/lib/ingestion/sources";
import { markOverdueGoals } from "@/lib/data/goals";
import { jsonError, jsonOk } from "@/lib/http";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

// Long-lived cron invocation; allow up to 60s for slow upstreams.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  if (!isAuthorizedCron(req)) {
    logger.warn("cron.unauthorized", { route: "/api/cron/ingest", requestId });
    return jsonError("unauthorized");
  }
  const started = Date.now();
  await ensureVaticanSchedule();
  const summary = await runAllActiveJobs();
  const [prunedRateLimits, prunedTokens, overdueGoals] = await Promise.all([
    pruneExpiredRateLimits(),
    pruneExpiredTokens(),
    markOverdueGoals(),
  ]);
  logger.info("cron.completed", {
    route: "/api/cron/ingest",
    requestId,
    durationMs: Date.now() - started,
    summary,
    prunedRateLimits,
    prunedTokens,
    overdueGoals,
  });
  return jsonOk({ summary, prunedRateLimits, prunedTokens, overdueGoals });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
