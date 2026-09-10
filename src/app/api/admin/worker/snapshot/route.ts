/**
 * GET /api/admin/worker/snapshot — the command-centre snapshot, for a phone.
 *
 * The macOS console's `GET /api/snapshot` returns `loadCommandCenterSnapshot`
 * whole. That call is roughly thirty queries against the production database
 * and the untrimmed JSON runs to hundreds of kilobytes. Neither is acceptable
 * from a device on mobile data polling over the public internet, so this route
 * applies the same three guards the local host applies plus a projection:
 *
 *   - single flight: two concurrent callers share one load;
 *   - cached 30 s while a worker is executing, 5 minutes when it is not;
 *   - `refreshGoals` is never true, so a phone poll cannot write content goals;
 *   - the payload is trimmed (see `trimSnapshotForMobile`).
 *
 * `?refresh=1` skips the TTL for a deliberate pull-to-refresh. It cannot skip
 * the single flight, and it has its own much tighter rate limit, because it is
 * the only phone-triggered path that runs the thirty queries on demand.
 */

import { type NextRequest } from "next/server";

import { prisma } from "@/lib/db/client";
import { jsonError, jsonOk } from "@/lib/http";
import { loadRemoteSnapshot, readRemoteWorkerStatus } from "@/lib/admin-worker/remote-console";
import { logger } from "@/lib/observability/logger";
import { rateLimit } from "@/lib/security/rate-limit";
import { gateAdminApiCall } from "@/lib/security/admin-gate";

import {
  noStore,
  rateLimited,
  requestIdOf,
  WORKER_SNAPSHOT_RATE,
  WORKER_SNAPSHOT_REFRESH_RATE,
} from "../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const limit = await rateLimit(`admin-worker-snapshot:${admin.username}`, WORKER_SNAPSHOT_RATE);
  if (!limit.ok) return rateLimited(req, limit, WORKER_SNAPSHOT_RATE, "worker_snapshot_poll");

  const force = req.nextUrl.searchParams.get("refresh") === "1";
  if (force) {
    const refreshLimit = await rateLimit(
      `admin-worker-snapshot-refresh:${admin.username}`,
      WORKER_SNAPSHOT_REFRESH_RATE,
    );
    if (!refreshLimit.ok) {
      return rateLimited(
        req,
        refreshLimit,
        WORKER_SNAPSHOT_REFRESH_RATE,
        "worker_snapshot_forced_refresh",
      );
    }
  }

  try {
    // The (2 s-cached) status read decides the TTL: a running worker's numbers
    // move, an idle worker's do not. It is also what the phone renders above
    // the snapshot, so returning it here saves the client a second round-trip.
    const status = await readRemoteWorkerStatus(prisma);
    const result = await loadRemoteSnapshot(prisma, {
      force,
      executionState: status.execution.known ? status.execution.state : null,
    });
    return noStore(
      jsonOk({
        status,
        snapshot: result.snapshot,
        cache: {
          cached: result.cached,
          ageMs: result.ageMs,
          ttlMs: result.ttlMs,
          coalesced: result.coalesced,
          nextPollAfterMs: result.nextPollAfterMs,
          forced: force,
        },
      }),
    );
  } catch (error) {
    logger.error("admin_worker.remote_snapshot_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonError("server_error", {
      status: 503,
      message: "worker_snapshot_unavailable",
      requestId: requestIdOf(req),
    });
  }
}
