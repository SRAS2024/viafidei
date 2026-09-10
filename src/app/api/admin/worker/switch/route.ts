/**
 * POST /api/admin/worker/switch — the one mutation the phone can make.
 *
 * It writes the durable master-switch row and nothing else. It does NOT
 * acquire the execution lease, spawn anything, or touch the worker: the Mac
 * host's reconcile poll (7 s) reads the row and makes reality match it, on the
 * Mac, with the Mac's resources. That is the whole reason the switch is a
 * database row rather than an RPC — the phone physically cannot become a
 * worker, and the switch can be set while the Mac is asleep and honoured when
 * it wakes.
 *
 * SECURITY. This endpoint can start a workload against production, so it goes
 * through `gateAdminApiCall` like every other admin mutation — CSRF, banned
 * device, and a completed-2FA admin session, in that order. There is
 * deliberately no second authentication path for the phone and no exemption:
 * a native client authenticates by presenting exactly what a browser presents
 * (the session cookie jar plus an `Origin` header naming the canonical
 * origin). See the route contract in the owner report.
 *
 * Every accepted change is recorded twice with the actor: an `AdminActionLog`
 * row (the security-facing "who did what, from what device" log the Developer
 * Audit report reads) and an `AdminAuditLog` row carrying the before/after
 * value.
 */

import { type NextRequest } from "next/server";

import { writeAdminActionLog } from "@/lib/audit/admin-action-log";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db/client";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import {
  invalidateRemoteWorkerStatus,
  readRemoteWorkerStatus,
  SWITCH_ACTUATION_WINDOW_MS,
} from "@/lib/admin-worker/remote-console";
import { readMasterSwitch, setMasterSwitch } from "@/lib/admin-worker/execution-host";
import { logger } from "@/lib/observability/logger";
import { rateLimit } from "@/lib/security/rate-limit";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { getClientIpOrNull, getUserAgent } from "@/lib/security/request";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";

import {
  noStore,
  normalizeSwitchClient,
  rateLimited,
  requestIdOf,
  SWITCH_ACTION_OFF,
  SWITCH_ACTION_ON,
  WORKER_SWITCH_RATE,
} from "../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SwitchBody = { on?: unknown; client?: unknown; reason?: unknown };

export async function POST(req: NextRequest) {
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;
  const { admin } = gate;
  const requestId = requestIdOf(req);

  const limit = await rateLimit(`admin-worker-switch:${admin.username}`, WORKER_SWITCH_RATE);
  if (!limit.ok) return rateLimited(req, limit, WORKER_SWITCH_RATE, "worker_switch");

  const body = await readJsonBody<SwitchBody>(req, { limitBytes: 4 * 1024 });
  if (!body.ok) {
    return jsonError(body.reason === "too_large" ? "too_large" : "invalid", {
      message: body.reason === "missing" ? "body_required" : body.reason,
      requestId,
    });
  }
  // Strictly boolean. Accepting "true"/1 would mean a client typo silently
  // starts a production workload.
  if (typeof body.data.on !== "boolean") {
    return jsonError("invalid", { message: "on_must_be_boolean", requestId });
  }
  const on = body.data.on;
  const from = normalizeSwitchClient(body.data.client);
  const reason = typeof body.data.reason === "string" ? body.data.reason.slice(0, 200) : null;

  // Previous value for the audit trail. An unreadable row must not block the
  // operator's intent, so a failed read is recorded as "unknown", not as OFF.
  const previous = await readMasterSwitch(prisma);
  const previousOn = previous.known ? previous.on : null;

  let next;
  try {
    next = await setMasterSwitch(prisma, { on, actor: admin.username, from });
  } catch (error) {
    // The switch did NOT change. Saying otherwise would leave the phone
    // showing a state the Mac will never reconcile to.
    logger.error("admin_worker.remote_switch_write_failed", {
      on,
      actor: admin.username,
      error: error instanceof Error ? error.message : String(error),
    });
    await writeAdminActionLog({
      adminUsername: admin.username,
      actionType: on ? SWITCH_ACTION_ON : SWITCH_ACTION_OFF,
      route: req.nextUrl.pathname,
      method: "POST",
      result: "failure",
      deviceCredential: req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null,
      ipAddress: getClientIpOrNull(req),
      userAgent: getUserAgent(req),
      metadata: { requestedOn: on, from, previousOn, reason },
    });
    return jsonError("server_error", {
      status: 503,
      message: "switch_write_failed",
      requestId,
    });
  }

  // Recorded with the actor: the security-facing action log (device / IP /
  // user-agent fingerprints, Developer Audit report) and the before/after
  // audit row. Both are best-effort by design and never throw.
  await writeAdminActionLog({
    adminUsername: admin.username,
    actionType: on ? SWITCH_ACTION_ON : SWITCH_ACTION_OFF,
    route: req.nextUrl.pathname,
    method: "POST",
    result: "success",
    deviceCredential: req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    metadata: { on, from, previousOn, reason },
  });
  await writeAudit({
    action: "admin.worker.master_switch",
    entityType: "AdminWorkerSwitch",
    entityId: "worker.execution.switch",
    actorUsername: admin.username,
    ipAddress: getClientIpOrNull(req),
    userAgent: getUserAgent(req),
    previousValue: { on: previousOn, known: previous.known },
    newValue: { on, changedFrom: from, ...(reason ? { reason } : {}) },
    requestId: requestId ?? null,
  });

  logger.info("admin_worker.remote_switch_set", {
    on,
    from,
    actor: admin.username,
    previousOn,
  });

  // The cached status still says the old value; drop it so the response — the
  // thing the phone renders immediately — reflects the write.
  invalidateRemoteWorkerStatus();
  const status = await readRemoteWorkerStatus(prisma, { force: true }).catch(() => null);

  return noStore(
    jsonOk({
      switch: next,
      previousOn,
      status,
      // Execution does not change here: the Mac reconciles within its poll
      // interval. Tell the phone how long "pending" is legitimate so it does
      // not report a failure the operator does not have.
      actuation: {
        pending: true,
        windowMs: SWITCH_ACTUATION_WINDOW_MS,
        note: "The Mac host reconciles the durable switch on its own poll; execution state follows within this window.",
      },
    }),
  );
}
