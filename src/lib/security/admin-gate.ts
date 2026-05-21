/**
 * Unified entry-point gate for admin API routes.
 *
 *   * CSRF check (mutations only — safe methods pass through).
 *   * Banned-device block.
 *   * requireAdmin() session check.
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
 */

import { type NextRequest } from "next/server";
import { type AdminPrincipal } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { assertNotBanned } from "./banned-guard";
import { evaluateCsrf, assertCsrfOk } from "./csrf";
import { evaluateAdminTrust } from "./admin-trust";
import { reportSecurityBreach, reportSuspiciousActivity } from "./security-events";
import { recordAdminScan } from "./admin-route-scanner";
import { getClientIpOrNull, getUserAgent } from "./request";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";

export type AdminGateOutcome =
  | { ok: true; admin: AdminPrincipal }
  | { ok: false; response: Response };

export async function gateAdminApiCall(req: NextRequest): Promise<AdminGateOutcome> {
  // 1. CSRF — mutations only. A failed check is a Security Breach.
  const decision = evaluateCsrf(req);
  if (!decision.ok) {
    void reportSecurityBreach({
      kind: "csrf_violation",
      summary: `CSRF check failed on ${req.method} ${req.nextUrl.pathname} (expected ${decision.expected}, got ${decision.got ?? "missing"}).`,
      ipAddress: getClientIpOrNull(req) ?? undefined,
      userAgent: getUserAgent(req) ?? undefined,
      route: req.nextUrl.pathname,
      httpMethod: req.method,
      deviceCredential: req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value,
      attemptedAction: "admin_api_call",
    });
    const blocked = assertCsrfOk(req);
    if (blocked) return { ok: false, response: blocked };
  }

  // 2. Banned device — block before any admin work runs.
  const banned = await assertNotBanned(req);
  if (banned) return { ok: false, response: banned };

  // 3. Admin session trust rule. The suspicious-activity logic checks
  //    authentication state FIRST: a request with a valid admin
  //    session is trusted authenticated admin activity and proceeds
  //    without any suspicious-activity classification.
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
    deviceCredential: req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value,
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
      deviceCredential: req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value,
      attemptedAccountOrRoute: req.nextUrl.pathname,
      recommendedAction:
        "Investigate whether a developer is checking admin URLs or an attacker is enumerating endpoints; escalate to a Security Breach if a follow-up active-attack event is observed.",
    });
  }
  return { ok: false, response: jsonError("unauthorized") };
}
