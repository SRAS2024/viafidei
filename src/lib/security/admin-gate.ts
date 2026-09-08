/**
 * Unified entry-point gate for admin API routes. This is the AUTHORITATIVE
 * admin authorization path — there is deliberately no second one.
 *
 *   * CSRF check (mutations only — safe methods pass through).
 *   * Banned-device block.
 *   * Admin session trust: authenticated (password + second factor),
 *     unrevoked, inside its idle and absolute windows.
 *
 * Routes call `gateAdminApiCall(req)` as the first thing they do.
 * The helper returns either `{ ok: true, admin }` (proceed) or
 * `{ ok: false, response }` (return that response immediately).
 *
 * Failed CSRF -> Security Breach event with cross_origin context.
 * Failed banned-device -> 403 (caller has no way to log because
 * banned-device fingerprint is already in the SecurityEvent that
 * triggered the original ban — re-logging would amount to a denial
 * of service against the admin mailbox).
 *
 * FAIL CLOSED (spec item 9). Every stage here decides authorization, so an
 * indeterminate answer is a denial:
 *   * CSRF — a missing or mismatched Origin/Referer is refused, and the
 *     refusal is unconditional rather than depending on a second evaluation.
 *   * Banned device — if the ban table cannot be read we cannot prove the
 *     device is NOT banned, so the request is refused with 503 and the
 *     outage is reported. (Note the contrast with `assertNotBanned`, which
 *     swallows store errors for the non-admin surfaces it protects.)
 *   * Admin session — `requireAdmin()` itself fails closed.
 * The Admin Worker defender at the bottom is the one deliberate exception:
 * it is reporting, not authorization, and must never become a dependency of
 * the gate. It stays fire-and-forget.
 */

import { type NextRequest } from "next/server";
import { type AdminPrincipal } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { logger } from "@/lib/observability/logger";
import { isDeviceBanned, recordBannedDeviceHit } from "./security-event-store";
import { evaluateCsrf } from "./csrf";
import { evaluateAdminTrust } from "./admin-trust";
import { reportSecurityBreach, reportSuspiciousActivity } from "./security-events";
import { recordAdminScan } from "./admin-route-scanner";
import { getClientIpOrNull, getUserAgent } from "./request";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";

export type AdminGateOutcome =
  | { ok: true; admin: AdminPrincipal }
  | { ok: false; response: Response };

function csrfBlocked(reason: string): Response {
  return new Response(JSON.stringify({ error: "csrf", reason }), {
    status: 403,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function bannedDeviceBlocked(): Response {
  return new Response("Forbidden", {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

type BanState = "clear" | "banned" | "indeterminate";

/**
 * Resolve the request's banned-device state. Unlike `assertNotBanned`, a
 * store failure here is NOT treated as "not banned": this gate is the
 * enforcement point for admin mutations, and letting a ban lookup fail open
 * would hand a banned device the admin API during any database blip.
 */
async function resolveBanState(credential: string | undefined): Promise<BanState> {
  if (!credential) return "clear";
  try {
    const banned = await isDeviceBanned(credential);
    if (!banned) return "clear";
    // Best-effort: the admin page shows "still attempting access". A failed
    // touch must not turn a confirmed ban into a pass.
    await recordBannedDeviceHit(credential).catch(() => undefined);
    return "banned";
  } catch (error) {
    logger.error("security.admin_gate.ban_state_indeterminate", {
      error: error instanceof Error ? error.message : String(error),
    });
    return "indeterminate";
  }
}

export async function gateAdminApiCall(req: NextRequest): Promise<AdminGateOutcome> {
  const deviceCredential = req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value;

  // 1. CSRF — mutations only. A failed check is a Security Breach, and the
  //    request is refused unconditionally (no second evaluation that could
  //    disagree and let the mutation through).
  const decision = evaluateCsrf(req);
  if (!decision.ok) {
    void reportSecurityBreach({
      kind: "csrf_violation",
      summary: `CSRF check failed on ${req.method} ${req.nextUrl.pathname} (expected ${decision.expected}, got ${decision.got ?? "missing"}).`,
      ipAddress: getClientIpOrNull(req) ?? undefined,
      userAgent: getUserAgent(req) ?? undefined,
      route: req.nextUrl.pathname,
      httpMethod: req.method,
      deviceCredential,
      attemptedAction: "admin_api_call",
    });
    return { ok: false, response: csrfBlocked(decision.reason) };
  }

  // 2. Banned device — block before any admin work runs.
  const banState = await resolveBanState(deviceCredential);
  if (banState === "banned") {
    return { ok: false, response: bannedDeviceBlocked() };
  }
  if (banState === "indeterminate") {
    void reportSuspiciousActivity({
      kind: "banned_device_state_indeterminate",
      summary: `The banned-device store could not be read on ${req.method} ${req.nextUrl.pathname} — the admin API is failing closed until it recovers.`,
      ipAddress: getClientIpOrNull(req) ?? undefined,
      userAgent: getUserAgent(req) ?? undefined,
      route: req.nextUrl.pathname,
      deviceCredential,
      recommendedAction:
        "Check database availability. Admin API calls stay denied while ban state is unknown; public pages and the Admin Worker are unaffected.",
    });
    return {
      ok: false,
      response: jsonError("server_error", { status: 503, message: "security_state_unavailable" }),
    };
  }

  // 3. Admin session trust rule. The suspicious-activity logic checks
  //    authentication state FIRST: a request with a valid admin
  //    session is trusted authenticated admin activity and proceeds
  //    without any suspicious-activity classification. "Valid" means
  //    both sign-in stages completed — a password-verified PENDING
  //    session is refused here exactly like an anonymous caller.
  const trust = await evaluateAdminTrust(req);
  if (trust.trusted) {
    return { ok: true, admin: trust.admin };
  }

  // No valid admin session — unauthenticated access of a protected
  // admin route. Track it per (IP + device credential) so we can
  // detect sustained admin-route scanning. Single 401s are benign —
  // admins typo URLs, browsers race the session cookie, etc. But more
  // than a handful of distinct admin paths from the same caller in a
  // short window is a probe pattern that fires Suspicious Activity
  // (NOT a Security Breach — the request was blocked).
  const scan = recordAdminScan({
    ipAddress: getClientIpOrNull(req),
    deviceCredential,
    path: req.nextUrl.pathname,
  });
  if (scan.classification === "suspicious") {
    void reportSuspiciousActivity({
      kind: "admin_route_scan",
      summary: `Sustained unauthenticated probing of admin routes — ${scan.distinctPaths} distinct paths within ${Math.round(
        scan.windowMs / 60000,
      )} minutes from ${getClientIpOrNull(req) ?? "unknown"}.`,
      ipAddress: getClientIpOrNull(req) ?? undefined,
      userAgent: getUserAgent(req) ?? undefined,
      route: req.nextUrl.pathname,
      deviceCredential,
      attemptedAccountOrRoute: req.nextUrl.pathname,
      recommendedAction:
        "Investigate whether a developer is checking admin URLs or an attacker is enumerating endpoints; escalate to a Security Breach if a follow-up active-attack event is observed.",
    });
  }

  // Admin Worker defender hook (spec §12 follow-up). Fires on
  // unauthorized mutation attempts so AdminWorkerSecurityAction is
  // recorded alongside the SecurityEvent. The defender bans the
  // device when the fingerprint + confidence are strong; otherwise
  // it records OBSERVE / WARN. Fire-and-forget — never blocks the
  // request handler, and deliberately NOT part of the authorization
  // decision above: the worker must never become a dependency of
  // basic admin authentication.
  const method = req.method.toUpperCase();
  if (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") {
    void (async () => {
      try {
        const { prisma } = await import("@/lib/db/client");
        const { defendUnauthorizedMutation } = await import("@/lib/admin-worker/request-defender");
        const { deviceCredentialFingerprint, ipFingerprint, userAgentFingerprint } =
          await import("./hash");
        await defendUnauthorizedMutation({
          prisma,
          route: req.nextUrl.pathname,
          ipHash: ipFingerprint(getClientIpOrNull(req)),
          userAgentHash: userAgentFingerprint(getUserAgent(req)),
          deviceFingerprintHash: deviceCredentialFingerprint(deviceCredential),
        });
      } catch {
        // ignore — defender hook is fire-and-forget
      }
    })();
  }

  return { ok: false, response: jsonError("unauthorized") };
}
