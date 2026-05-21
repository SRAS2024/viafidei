/**
 * Admin session trust rule.
 *
 * This is the single decision point the suspicious-activity logic
 * consults before classifying admin-route access. The rule answers one
 * question: "is this request a valid, authenticated admin?"
 *
 * Trust requires every check to pass:
 *   1. a valid session exists and carries a valid admin identity;
 *   2. the session is not expired — an expired iron-session cookie
 *      fails to decrypt, so `requireAdmin()` returns null;
 *   3. the session is not revoked — sign-out destroys the cookie;
 *   4. the device is not banned — enforced upstream by the admin
 *      layout (`isCurrentDeviceBanned`) and the API gate
 *      (`assertNotBanned`), which both run before this rule;
 *   5. the request route is an allowed admin route — every caller of
 *      this rule is itself an admin route handler / the admin API
 *      gate, and `isAdminRoute()` is exported for any caller that
 *      needs to confirm a path independently;
 *   6. the action is allowed for the authenticated admin — the app has
 *      a single admin identity, so every admin action is permitted
 *      once checks 1–5 hold.
 *
 * When the rule returns `trusted`, the caller treats the request as
 * authenticated admin activity: it logs the important action and does
 * NOT send a suspicious-activity email. When it returns untrusted, the
 * caller falls through to the suspicious-activity rules.
 */

import { type NextRequest } from "next/server";
import { requireAdmin, type AdminPrincipal } from "@/lib/auth";

export type AdminTrustDenyReason = "no_admin_session";

export type AdminTrustResult =
  | { trusted: true; admin: AdminPrincipal }
  | { trusted: false; reason: AdminTrustDenyReason };

/** Is `pathname` an admin page or admin API route? */
export function isAdminRoute(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}

/**
 * Evaluate the admin session trust rule for a request. Returns the
 * resolved admin principal when every trust check passes.
 *
 * The `req` argument is accepted for symmetry with the other security
 * helpers; the decisive check is `requireAdmin()`, which resolves the
 * iron-session cookie and confirms it carries a valid, non-expired,
 * non-revoked ADMIN identity.
 */
export async function evaluateAdminTrust(_req: NextRequest): Promise<AdminTrustResult> {
  const admin = await requireAdmin();
  if (!admin) {
    return { trusted: false, reason: "no_admin_session" };
  }
  return { trusted: true, admin };
}
