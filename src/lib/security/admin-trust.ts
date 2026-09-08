/**
 * Admin session trust rule.
 *
 * This is the single decision point the suspicious-activity logic
 * consults before classifying admin-route access. The rule answers one
 * question: "is this request a valid, authenticated admin?"
 *
 * Trust requires every check to pass:
 *   1. a valid session exists and carries a valid admin identity;
 *   2. BOTH sign-in stages completed — the password AND the second
 *      factor. A password-verified PENDING session is never trusted;
 *      `requireAdmin()` resolves the server-side `AdminSession` row and
 *      returns null while the row is still PENDING;
 *   3. the session is not expired — the server-side row carries an idle
 *      window and an absolute window, and an expired iron-session cookie
 *      also fails to decrypt, so `requireAdmin()` returns null;
 *   4. the session is not revoked — sign-out revokes the server-side row
 *      before it destroys the cookie, so a copied cookie dies with it;
 *   5. the device is not banned — enforced upstream by the admin
 *      layout (`isCurrentDeviceBanned`) and the API gate
 *      (`gateAdminApiCall`), which both run before this rule;
 *   6. the request route is an allowed admin route — every caller of
 *      this rule is itself an admin route handler / the admin API
 *      gate, and `isAdminRoute()` is exported for any caller that
 *      needs to confirm a path independently;
 *   7. the action is allowed for the authenticated admin — the app has
 *      a single admin identity, so every admin action is permitted
 *      once checks 1–6 hold.
 *
 * When the rule returns `trusted`, the caller treats the request as
 * authenticated admin activity: it logs the important action and does
 * NOT send a suspicious-activity email. When it returns untrusted, the
 * caller falls through to the suspicious-activity rules.
 *
 * FAIL CLOSED: this rule never answers "trusted" on an error path. If the
 * authorization state cannot be determined at all, it returns
 * `indeterminate` — a DENY that the caller records — rather than letting an
 * exception escape into a route handler that might treat a 500 as a pass.
 */

import { type NextRequest } from "next/server";
import { requireAdmin, type AdminPrincipal } from "@/lib/auth";
import { logger } from "@/lib/observability/logger";

export type AdminTrustDenyReason = "no_admin_session" | "indeterminate";

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
 * iron-session cookie AND its server-side `AdminSession` row and confirms it
 * carries a completed-2FA, non-expired, non-revoked ADMIN identity.
 */
export async function evaluateAdminTrust(_req: NextRequest): Promise<AdminTrustResult> {
  let admin: AdminPrincipal | null;
  try {
    admin = await requireAdmin();
  } catch (error) {
    // requireAdmin() is written not to throw; if it ever does, an unknown
    // authorization state must deny, not fall through to the caller.
    logger.error("security.admin_trust.indeterminate", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { trusted: false, reason: "indeterminate" };
  }
  if (!admin) {
    return { trusted: false, reason: "no_admin_session" };
  }
  return { trusted: true, admin };
}
