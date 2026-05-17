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
import { requireAdmin, type AdminPrincipal } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { assertNotBanned } from "./banned-guard";
import { evaluateCsrf, assertCsrfOk } from "./csrf";
import { reportSecurityBreach } from "./security-events";
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

  // 3. Admin auth.
  const admin = await requireAdmin();
  if (!admin) return { ok: false, response: jsonError("unauthorized") };

  return { ok: true, admin };
}
