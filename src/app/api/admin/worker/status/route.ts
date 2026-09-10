/**
 * GET /api/admin/worker/status — what the iPhone polls.
 *
 * The equivalent of the macOS console's `GET /api/status`, except that the
 * desktop reads its own supervisor process over loopback and the phone cannot.
 * So this answers from the durable rows instead: the master switch, the
 * execution lease, the Mac host-presence row, and AdminWorkerState.
 *
 * Cheap by construction — three small reads, cached for two seconds per server
 * instance — because a phone polls it. The expensive command-centre snapshot
 * lives at the sibling `/snapshot` route with its own, much longer, cache.
 *
 * Read-only in every sense: nothing here writes a row, not even the
 * `AdminWorkerState` upsert the shared state helper would do.
 */

import { type NextRequest } from "next/server";

import { prisma } from "@/lib/db/client";
import { jsonError, jsonOk } from "@/lib/http";
import { readRemoteWorkerStatus } from "@/lib/admin-worker/remote-console";
import { logger } from "@/lib/observability/logger";
import { rateLimit } from "@/lib/security/rate-limit";
import { gateAdminApiCall } from "@/lib/security/admin-gate";

import { noStore, rateLimited, requestIdOf, WORKER_STATUS_RATE } from "../shared";

// Prisma + the durable-row helpers are Node-only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // The central gate. On a safe method its CSRF stage is a documented no-op,
  // so a native client needs no Origin header to READ — but banned-device
  // enforcement and the completed-2FA admin session are enforced exactly as
  // they are for the browser admin.
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const limit = await rateLimit(`admin-worker-status:${admin.username}`, WORKER_STATUS_RATE);
  if (!limit.ok) return rateLimited(req, limit, WORKER_STATUS_RATE, "worker_status_poll");

  try {
    const status = await readRemoteWorkerStatus(prisma);
    return noStore(jsonOk({ status }));
  } catch (error) {
    // readRemoteWorkerStatus is written not to throw (every reader reports an
    // unreadable database as `known: false`). If it ever does, say so plainly
    // rather than letting the phone render a 500 body as "worker off".
    logger.error("admin_worker.remote_status_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonError("server_error", {
      status: 503,
      message: "worker_status_unavailable",
      requestId: requestIdOf(req),
    });
  }
}
