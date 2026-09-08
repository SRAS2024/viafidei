/**
 * Admin-route security guard (spec §12 follow-up).
 *
 * One-line wrapper that:
 *   1. Calls requireAdmin() exactly like before.
 *   2. When the request is unauthorized AND uses a mutation HTTP
 *      method (POST/PUT/PATCH/DELETE), fires
 *      defendUnauthorizedMutation() so the Admin Worker records the
 *      attempt + bans the device when fingerprint + confidence are
 *      strong enough.
 *
 * NOT A SECOND AUTHENTICATION SYSTEM. `gateAdminApiCall` in
 * `src/lib/security/admin-gate.ts` is the authoritative admin gate (CSRF +
 * banned device + completed-2FA session) and already fires this same
 * defender hook. This wrapper exists only for callers that need the bare
 * principal — it adds reporting, never authority, and it delegates the whole
 * authorization decision to `requireAdmin()`. New admin API routes should
 * call `gateAdminApiCall` instead.
 *
 * The defender is the Admin Worker's *reporting* path, so it is
 * fire-and-forget and wrapped: the worker must never become a dependency of
 * basic admin authentication. A defender that is down, slow or throwing
 * cannot change the decision below, and cannot fail the request either.
 * Read-only GETs do not trigger the defender — anonymous GETs to admin
 * routes are redirected by middleware, not treated as breaches.
 */

import type { NextRequest } from "next/server";

import type { AdminPrincipal } from "@/lib/auth";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { getClientIp, getUserAgent } from "@/lib/security/request";
import {
  deviceCredentialFingerprint,
  ipFingerprint,
  userAgentFingerprint,
} from "@/lib/security/hash";
import { defendUnauthorizedMutation } from "@/lib/admin-worker/request-defender";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Authenticate the current request as admin. On unauthorized
 * mutation, fire the defender. Returns the admin user on success,
 * `null` on failure (same shape as `requireAdmin`).
 *
 * `requireAdmin()` fails closed on its own — an unreadable cookie or an
 * unreachable admin-session store returns null, never a principal.
 */
export async function requireAdminWithDefender(req: NextRequest): Promise<AdminPrincipal | null> {
  const admin = await requireAdmin();
  if (admin) return admin;

  // Unauthorized — defender only fires for mutations.
  if (MUTATION_METHODS.has(req.method.toUpperCase())) {
    // A synchronous throw from the defender (an unavailable client, a module
    // that failed to load) would otherwise propagate out of this guard and
    // turn a clean 401 into a 500. Report-only paths never do that.
    try {
      const ip = getClientIp(req);
      const userAgent = getUserAgent(req);
      const deviceCredential = req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null;
      void Promise.resolve(
        defendUnauthorizedMutation({
          prisma,
          route: req.nextUrl.pathname,
          ipHash: ipFingerprint(ip),
          userAgentHash: userAgentFingerprint(userAgent),
          deviceFingerprintHash: deviceCredentialFingerprint(deviceCredential),
        }),
      ).catch(() => undefined);
    } catch {
      // ignore — defender hook is fire-and-forget
    }
  }
  return null;
}
