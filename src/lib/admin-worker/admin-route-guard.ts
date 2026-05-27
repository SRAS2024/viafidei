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
 * Admin routes import this once instead of `requireAdmin` so the
 * defender hook is automatic and consistent. Read-only GETs do not
 * trigger the defender — anonymous GETs to admin routes are
 * redirected by middleware, not treated as breaches.
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
 */
export async function requireAdminWithDefender(req: NextRequest): Promise<AdminPrincipal | null> {
  const admin = await requireAdmin();
  if (admin) return admin;

  // Unauthorized — defender only fires for mutations.
  if (MUTATION_METHODS.has(req.method.toUpperCase())) {
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);
    const deviceCredential = req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null;
    void defendUnauthorizedMutation({
      prisma,
      route: req.nextUrl.pathname,
      ipHash: ipFingerprint(ip),
      userAgentHash: userAgentFingerprint(userAgent),
      deviceFingerprintHash: deviceCredentialFingerprint(deviceCredential),
    });
  }
  return null;
}
